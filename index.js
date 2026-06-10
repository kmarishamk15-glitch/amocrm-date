const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CODE_VERSION = "1.0.0";

// IDs
const PIPELINE_SERVICES = 5240944;
const PIPELINE_TECHNIQUE = 5276629;

const STAGE_NEW_LEAD = 47069740;
const STAGE_CLOSED_NOT_REALIZED = 143;

const CUSTOM_FIELD_DATE_ID = 573623;

// healthcheck
app.get("/", (req, res) => {
  console.log("GET / OK");
  res.send("OK v" + CODE_VERSION);
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("🔥 WEBHOOK HIT");
    console.log("BODY:", JSON.stringify(req.body, null, 2));

    const lead =
      req.body?.leads?.update?.[0] ||
      req.body?.leads?.add?.[0];

    if (!lead?.id) {
      console.log("No lead id, exit");
      return res.sendStatus(200);
    }

    const leadId = lead.id;
    const pipelineId = lead.pipeline_id;
    const stageId = lead.status_id;

    console.log("Lead:", { leadId, pipelineId, stageId });

    // только воронка Техника
    if (pipelineId !== PIPELINE_TECHNIQUE) {
      console.log("Not technique pipeline, skip");
      return res.sendStatus(200);
    }

    // если стадия 143 — ничего не делаем
    if (stageId === STAGE_CLOSED_NOT_REALIZED) {
      console.log(`Lead ${leadId}: stage 143 → skip date update`);
      return res.sendStatus(200);
    }

    const subdomain = process.env.AMO_SUBDOMAIN;
    const token = process.env.AMO_ACCESS_TOKEN;

    console.log("ENV:", {
      subdomain,
      tokenExists: !!token
    });

    if (!subdomain || !token) {
      console.log("ERROR: missing credentials");
      return res.sendStatus(200);
    }

    const url = `https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`;

    // ⚡ лучше ISO формат (amoCRM стабильнее его принимает)
    const today = new Date().toISOString();

    console.log("PATCH URL:", url);
    console.log("NEW DATE:", today);

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

    console.log("amoCRM response:", response.status);

    console.log(`Lead ${leadId}: date updated`);

    return res.sendStatus(200);

  } catch (e) {
    console.log("ERROR:", e.response?.data || e.message);
    return res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log("🚀 running on " + PORT);
});
