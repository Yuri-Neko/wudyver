import axios from "axios";
import * as cheerio from "cheerio";
const headers = {
  authority: "ttsave.app",
  accept: "application/json, text/plain, */*",
  origin: "https://ttsave.app",
  referer: "https://ttsave.app/en",
  "user-agent": "Postify/1.0.0"
};
const ttsave = {
  submit: async function(url, referer) {
    const headerx = {
      ...headers,
      referer: referer
    };
    const data = {
      query: url,
      language_id: "1"
    };
    return axios.post("https://ttsave.app/download", data, {
      headers: headerx
    });
  },
  parse: function($) {
    const uniqueId = $("#unique-id").val();
    const nickname = $("h2.font-extrabold").text();
    const profilePic = $("img.rounded-full").attr("src");
    const username = $("a.font-extrabold.text-blue-400").text();
    const description = $("p.text-gray-600").text();
    const dlink = {
      nowm: $("a.w-full.text-white.font-bold").first().attr("href"),
      wm: $("a.w-full.text-white.font-bold").eq(1).attr("href"),
      audio: $('a[type="audio"]').attr("href"),
      profilePic: $('a[type="profile"]').attr("href"),
      cover: $('a[type="cover"]').attr("href")
    };
    const stats = {
      plays: "",
      likes: "",
      comments: "",
      shares: ""
    };
    $(".flex.flex-row.items-center.justify-center").each((index, element) => {
      const $element = $(element);
      const svgPath = $element.find("svg path").attr("d");
      const value = $element.find("span.text-gray-500").text().trim();
      if (svgPath && svgPath.startsWith("M10 18a8 8 0 100-16")) {
        stats.plays = value;
      } else if (svgPath && svgPath.startsWith("M3.172 5.172a4 4 0 015.656")) {
        stats.likes = value || "0";
      } else if (svgPath && svgPath.startsWith("M18 10c0 3.866-3.582")) {
        stats.comments = value;
      } else if (svgPath && svgPath.startsWith("M17.593 3.322c1.1.128")) {
        stats.shares = value;
      }
    });
    const songTitle = $(".flex.flex-row.items-center.justify-center.gap-1.mt-5").find("span.text-gray-500").text().trim();
    const slides = $('a[type="slide"]').map((i, el) => ({
      number: i + 1,
      url: $(el).attr("href")
    })).get();
    return {
      uniqueId: uniqueId,
      nickname: nickname,
      profilePic: profilePic,
      username: username,
      description: description,
      dlink: dlink,
      stats: stats,
      songTitle: songTitle,
      slides: slides
    };
  },
  video: async function(link) {
    try {
      const response = await this.submit(link, "https://ttsave.app/en");
      const $ = cheerio.load(response.data);
      const result = this.parse($);
      return {
        type: "video",
        ...result,
        videoInfo: {
          nowm: result.dlink.nowm,
          wm: result.dlink.wm
        }
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  mp3: async function(link) {
    try {
      const response = await this.submit(link, "https://ttsave.app/en/mp3");
      const $ = cheerio.load(response.data);
      const result = this.parse($);
      return {
        type: "audio",
        uniqueId: result.uniqueId,
        nickname: result.nickname,
        username: result.username,
        songTitle: result.songTitle,
        description: result.description,
        stats: result.stats,
        audioUrl: result.dlink.audio,
        coverUrl: result.dlink.cover,
        profilePic: result.profilePic
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  slide: async function(link) {
    try {
      const response = await this.submit(link, "https://ttsave.app/en");
      const $ = cheerio.load(response.data);
      const result = this.parse($);
      if (result.slides.length === 0) {
        throw new Error("Hadeh, link tiktok lu bukan slide image tiktok anjirr 😂");
      }
      return {
        type: "slide",
        uniqueId: result.uniqueId,
        nickname: result.nickname,
        username: result.username,
        description: result.description,
        stats: result.stats,
        songTitle: result.songTitle,
        slides: result.slides,
        profilePic: result.profilePic,
        coverUrl: result.dlink.cover
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};
export default async function handler(req, res) {
  const {
    method
  } = req;
  const {
    url: link,
    type = "video"
  } = req.method === "GET" ? req.query : req.body;
  if (method === "GET") {
    if (!link) {
      return res.status(400).json({
        error: "Missing url parameter"
      });
    }
    try {
      let result;
      switch (type) {
        case "video":
          result = await ttsave.video(link);
          break;
        case "mp3":
          result = await ttsave.mp3(link);
          break;
        case "slide":
          result = await ttsave.slide(link);
          break;
        default:
          return res.status(400).json({
            error: "Invalid type. Use video, mp3, or slide"
          });
      }
      return res.status(200).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: error.message
      });
    }
  } else {
    return res.status(405).json({
      error: `Method ${method} Not Allowed`
    });
  }
}