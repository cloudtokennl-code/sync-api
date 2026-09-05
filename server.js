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

    // 1️⃣ Ga naar de homepage en wacht tot alle JS geladen is
    await page.goto("https://www.stuller.com/", { waitUntil: "networkidle2", timeout: 0 });

    // 2️⃣ Wacht expliciet op de zoekbalk (data-test="search-input")
    await page.waitForFunction(() => {
      const el = document.querySelector('input[data-test="search-input"]');
      return el && el.offsetParent !== null;
    }, { timeout: 60000 });

    // 3️⃣ Typ het serienummer in en druk op Enter
    await page.type('input[data-test="search-input"]', series);
    await page.keyboard.press("Enter");

    // 4️⃣ Wacht op redirect naar productpagina
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });

    // 5️⃣ Wacht op specificatietabel
    const selector = '[data-test="specifications"] table.detailsTable';
    await page.waitForSelector(selector, { timeout: 60000 });

    // 6️⃣ Lees de specificaties uit
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

    // 7️⃣ Opschonen → nette JSON keys
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
