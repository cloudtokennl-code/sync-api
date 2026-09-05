import express from "express";
import puppeteer from "puppeteer";

const app = express();

function cleanKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

app.get("/fetch", async (req, res) => {
  const series = req.query.url;
  if (!series) return res.status(400).json({ error: "Missing series number" });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // 1. Ga naar de homepage
    await page.goto("https://www.stuller.com/", { waitUntil: "domcontentloaded", timeout: 0 });

    // 2. Wacht op de juiste zoekbalk
    await page.waitForSelector('input[data-test="search-input"]', { visible: true, timeout: 60000 });

    // 3. Vul het serienummer in
    await page.type('input[data-test="search-input"]', series);

    // 4. Start de zoekactie
    await page.keyboard.press("Enter");

    // 5. Wacht op redirect naar productpagina
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });

    // 6. Wacht op specificatietabel
    const selector = '[data-test="specifications"] table.detailsTable';
    await page.waitForSelector(selector, { timeout: 60000 });

    // 7. Extract specificaties
    const specs = await page.evaluate((sel) => {
      const rows = document.querySelectorAll(`${sel} tr`);
      const data = {};
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length === 2) {
          const label = cells[0].innerText.trim();
          const value = cells[1].innerText.trim();
          data[label] = value;
        }
      });
      return data;
    }, selector);

    await browser.close();

    // 8. Opschonen → nette JSON keys
    const cleaned = {};
    for (const [label, value] of Object.entries(specs)) {
      if (!value || value === "-") continue;
      cleaned[cleanKey(label)] = value;
    }

    res.json(cleaned);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Puppeteer API running on port ${PORT}`);
});
