const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CODE_VERSION = "1.0.0";

// ID из ТЗ
const PIPELINE_SERVICES = 5240944;           // Услуги
const STAGE_NEW_LEAD = 47069740;              // получен новый лид
const PIPELINE_TECHNIQUE = 5276629;           // Техника
const STAGE_CLOSED_NOT_REALIZED = 143;        // Закрыто и не реализовано
const CUSTOM_FIELD_DATE_ID = 573623;          // Текущая дата

app.get("/", (req, res) => {
  res.send("OK v" + CODE_VERSION);
});

app.post("/webhook", async (req, res) => {
  try {
    // 🔥 Берём структуру из твоего рабочего кода
    const lead = req.body?.leads?.update?.[0] || req.body?.leads?.add?.[0];
    
    if (!lead?.id) return res.sendStatus(200);
    
    const leadId = lead.id;
    const pipelineId = lead.pipeline_id;
    const stageId = lead.status_id;
    
    // Проверяем: воронка Техника?
    if (pipelineId !== PIPELINE_TECHNIQUE) {
      return res.sendStatus(200);
    }
    
    // Если этап 143 — дата НЕ меняется
    if (stageId === STAGE_CLOSED_NOT_REALIZED) {
      console.log(`Lead ${leadId}: stage 143 — skip`);
      return res.sendStatus(200);
    }
    
    // Все остальные этапы — обновляем дату
    const subdomain = process.env.AMO_SUBDOMAIN;
    const token = process.env.AMO_ACCESS_TOKEN;
    
    if (!subdomain || !token) {
      console.log("ERROR: credentials not set");
      return res.sendStatus(200);
    }
    
    const today = Math.floor(Date.now() / 1000);
    const url = `https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`;
    
    // 🔥 Формат как в твоём рабочем коде
    await axios.patch(url, {
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
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    
    console.log(`Lead ${leadId}: date updated to ${new Date(today * 1000).toISOString()}`);
    
    return res.sendStatus(200);
    
  } catch (e) {
    console.log("ERROR:", e.response?.data || e.message);
    return res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log("running on " + PORT);
});
