const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Только 2 переменные!
const AMO_DOMAIN = process.env.AMO_DOMAIN;      // например: mycompany.amocrm.ru
const AMO_TOKEN = process.env.AMO_TOKEN;         // долгосрочный токен

// ID из вашего ТЗ
const PIPELINE_TECHNIQUE = 5276629;              // Техника
const STAGE_CLOSED_NOT_REALIZED = 143;           // Закрыто и не реализовано
const CUSTOM_FIELD_DATE_ID = 573623;             // "Текущая дата"

app.post('/webhook', async (req, res) => {
  try {
    const { leads } = req.body;
    if (!leads || !leads.updated) return res.status(200).send('OK');

    for (const lead of leads.updated) {
      const pipelineId = lead.pipeline_id;
      const stageId = lead.status_id;
      const leadId = lead.id;

      // Проверяем: воронка Техника?
      if (pipelineId !== PIPELINE_TECHNIQUE) continue;

      // Если этап "Закрыто и не реализовано" — ничего не делаем
      if (stageId === STAGE_CLOSED_NOT_REALIZED) {
        console.log(`Сделка ${leadId}: этап 143 — дата не меняется`);
        continue;
      }

      // Все остальные этапы — ставим сегодняшнюю дату
      const today = Math.floor(Date.now() / 1000);
      await axios.patch(
        `https://${AMO_DOMAIN}/api/v4/leads/${leadId}`,
        {
          custom_fields_values: [
            {
              field_id: CUSTOM_FIELD_DATE_ID,
              values: [{ value: today }]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${AMO_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Сделка ${leadId}: дата обновлена на ${new Date(today * 1000).toLocaleDateString('ru-RU')}`);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Ошибка:', err.response?.data || err.message);
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => res.send('Работает ✅'));

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
