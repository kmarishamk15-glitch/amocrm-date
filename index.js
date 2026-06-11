const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const CODE_VERSION = "1.0.0";

// IDs
const PIPELINE_TECHNIQUE = 5276629;
const STAGE_CLOSED_NOT_REALIZED = 143;
const CUSTOM_FIELD_DATE_ID = 573623;

/**
 * 🔥 ВАЖНО:
 * amoCRM может присылать JSON / form-urlencoded / сырой body
 * поэтому используем ВСЕ способы парсинга
 */

// JSON parser
app.use(express.json({ limit: "2mb" }));

// form-urlencoded parser
app.use(express.urlencoded({ extended: true }));

// RAW logger (самое важное для дебага)
app.use((req, res, next) => {
  let data = "";

  req.on("data", chunk => {
    data += chunk.toString();
  });

  req.on("end", () => {
    req.rawBody = data;

    console.log("🔥 RAW BODY:", data || "(empty)");
    next();
  });
});

// healthcheck
app.get("/", (req, res) => {
  console.log("GET / OK");
  res.send("OK v" + CODE_VERSION);
});

// webhook
app.post("/webhook", async (req, res) => {
  try {
    console.log("🔥 WEBHOOK HIT");

    console.log("📦 req.body:", req.body);
    console.log("📦 rawBody:", req.rawBody);

    // amoCRM может прислать разные структуры
    let lead =
      req.body?.leads?.update?.[0] ||
      req.body?.leads?.add?.[0] ||
      req.body?.leads?.status?.[0];

    // fallback: если пришло как строка в rawBody (редко, но бывает)
    if (!lead && req.rawBody?.includes("id=")) {
      console.log("⚠️ Detected non-JSON payload, skipping parse fallback");
    }

    if (!lead?.id) {
      console.log("❌ No lead id, exit");
      return res.sendStatus(200);
    }

    const leadId = lead.id;
    const pipelineId = lead.pipeline_id;
    const stageId = lead.status_id;

    console.log("👉 Lead:", { leadId, pipelineId, stageId });

    // фильтр: только Техника
    if (pipelineId !== PIPELINE_TECHNIQUE) {
      console.log("⛔ Skip: not technique pipeline");
      return res.sendStatus(200);
    }

    // если закрыто и не реализовано — не трогаем дату
    if (stageId === STAGE_CLOSED_NOT_REALIZED) {
      console.log("⛔ Skip: stage 143 (no update)");
      return res.sendStatus(200);
    }

    const subdomain = process.env.AMO_SUBDOMAIN;
    const token = process.env.AMO_ACCESS_TOKEN;
    
    // 🔍 ОТЛАДКА: пишем, что видит скрипт
    console.log("🔍 ENV DEBUG:");
    console.log("  • AMO_SUBDOMAIN:", subdomain ? `"${subdomain}"` : "undefined/empty");
    console.log("  • AMO_ACCESS_TOKEN:", token ? "set (length: " + token.length + ")" : "undefined/empty");
    
    if (!subdomain || !token) {
      console.log("❌ Missing credentials — проверьте переменные в Render!");
      return res.sendStatus(200);
    }

    const url = `https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`;

    // amoCRM надёжнее принимает timestamp
    const today = Math.floor(Date.now() / 1000);

    console.log("📤 PATCH:", url);
    console.log("📅 NEW DATE:", today);

    const response = await axios.patch(
      url,
      {
        custom_fields_values: [
          {
            field_id: CUSTOM_FIELD_DATE_ID,
            values: [
              {
                value: today
              }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ amoCRM response:", response.status);

    return res.sendStatus(200);

  } catch (e) {
    console.log("❌ ERROR:", e.response?.data || e.message);
    return res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log("🚀 running on " + PORT);
});
