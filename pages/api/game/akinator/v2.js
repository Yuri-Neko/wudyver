import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '../../../../lib/mongoose';
import akiSession from '../../../../models/AkinatorV2';

const regions = ['en', 'ar', 'cn', 'de', 'es', 'fr', 'il', 'it', 'jp', 'kr', 'nl', 'pt', 'ru', 'tr', 'id'];
const answers = ['Yes', 'No', 'Don\'t know', 'Probably', 'Probably not'];

class Akinator {
  constructor(region, childMode = false) {
    if (!regions.includes(region.toLowerCase())) throw new TypeError('Invalid region.');
    this.region = region.toLowerCase();
    this.childMode = Boolean(childMode);

    this.currentStep = 0;
    this.stepLastProposition = '';
    this.progress = '0.00000';
    this.answers = answers;
    this.question = null;
    this.session = null;
    this.signature = null;
    this.guessed = null;
    this.akiWin = null;
  }

  async start() {
    const { data } = await axios.post(`https://${this.region}.akinator.com/game`, {
      sid: '1',
      cm: this.childMode
    });

    const $ = cheerio.load(data);
    this.question = $('p.question-text#question-label').text();
    this.session = data.match(/session: '(.+)'/)[1];
    this.signature = data.match(/signature: '(.+)'/)[1];

    this.answers = [
      $('a#li-game-a_yes').text(),
      $('a#li-game-a_no').text(),
      $('a#li-game-a_dont_know').text(),
      $('a#li-game-a_probably').text(),
      $('a#li-game-a_probably_not').text()
    ];

    return this;
  }

  async step(answer) {
    const { data } = await axios.post(`https://${this.region}.akinator.com/answer`, {
      step: this.currentStep.toString(),
      progression: this.progress,
      sid: '1',
      cm: this.childMode,
      answer,
      step_last_proposition: this.stepLastProposition,
      session: this.session,
      signature: this.signature
    });

    if (data.id_proposition) {
      this.guessed = {
        id: data.id_proposition,
        name: data.name_proposition,
        description: data.description_proposition,
        photo: data.photo
      };
      return this;
    }

    this.currentStep++;
    this.progress = data.progression;
    this.question = data.question;
    if (!this.question) this.akiWin = false;
    return this;
  }

  async back() {
    const { data } = await axios.post(`https://${this.region}.akinator.com/cancel_answer`, {
      step: this.currentStep.toString(),
      progression: this.progress,
      sid: '1',
      cm: this.childMode,
      session: this.session,
      signature: this.signature
    });

    this.currentStep--;
    this.progress = data.progression;
    this.question = data.question;
    return this;
  }

  async guess(correct, keepGoing) {
    if (correct) {
      this.akiWin = true;
      return this;
    }
    if (!correct && keepGoing) {
      const { data } = await axios.post(`https://${this.region}.akinator.com/exclude`, {
        step: this.currentStep.toString(),
        sid: '1',
        cm: this.childMode,
        progression: this.progress,
        session: this.session,
        signature: this.signature
      });

      this.guessed = null;
      this.stepLastProposition = data.step;
      this.progress = data.progression;
      this.question = data.question;
      return this;
    }
    this.akiWin = false;
    return this;
  }
}

async function getOrCreateAkinator(sessionId) {
  try {
    const session = await akiSession.findOne({
      sessionId: sessionId
    });
    if (!session) return null;
    const api = new Akinator(session.region, session.childMode);
    api.progress = session.progress;
    api.currentStep = session.currentStep || 0;
    api.question = session.currentQuestion;
    api.sugestion_name = session.sugestion_name || null;
    api.sugestion_desc = session.sugestion_desc || null;
    api.sugestion_photo = session.sugestion_photo || null;
    api.isWin = session.isWin || false;
    return api;
  } catch (error) {
    console.error("Error loading Akinator session:", error);
    throw new Error("Failed to load Akinator session");
  }
}

async function saveSession(api, sessionId) {
  try {
    const updatedSession = {
      sessionId: sessionId,
      region: api.region,
      childMode: api.childMode,
      progress: api.progress,
      currentStep: api.currentStep,
      currentQuestion: api.question,
      isWin: api.akiWin,
      suggestion: api.akiWin ? {
        name: api.sugestion_name || null,
        description: api.sugestion_desc || null,
        photo: api.sugestion_photo || null
      } : null
    };
    await akiSession.updateOne({
      sessionId: sessionId
    }, updatedSession, {
      upsert: true
    });
  } catch (error) {
    console.error("Error saving Akinator session:", error);
    throw new Error("Failed to save Akinator session");
  }
}

export default async function handler(req, res) {
  try {
    await dbConnect();
    const { method } = req;
    const { id: sessionId, action } = req.method === "GET" ? req.query : req.body;

    if (method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

    if (action === "start") {
      try {
        const region = req.query.region && regions.includes(req.query.region) ? req.query.region : "en";
        const childMode = req.query.childMode === "true";
        const customSessionId = sessionId || uuidv4();
        const api = new Akinator(region, childMode);
        await api.start();
        await saveSession(api, customSessionId);
        return res.status(200).json({
          sessionId: customSessionId,
          question: api.question
        });
      } catch (error) {
        console.error("Error starting Akinator session:", error);
        return res.status(500).json({ message: "Failed to start session" });
      }
    }

    if (["answer", "cancel"].includes(action)) {
      if (!sessionId) return res.status(400).json({ message: "Session ID is required" });
      try {
        const api = await getOrCreateAkinator(sessionId);
        if (!api) return res.status(404).json({ message: "Session not found" });
        if (action === "answer") {
          const answer = req.query.answer ? parseInt(req.query.answer) : 0;
          await api.step(answer);
        } else if (action === "cancel") {
          await api.back();
        }
        await saveSession(api, sessionId);
        return res.status(200).json({
          question: api.question,
          progress: api.progress,
          isWin: api.akiWin,
          suggestion: api.akiWin ? api.suggestion : null
        });
      } catch (error) {
        console.error("Error handling Akinator action:", error);
        return res.status(500).json({ message: "Failed to process action" });
      }
    }

    if (action === "regions") {
      return res.status(200).json({ regions: regions });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
