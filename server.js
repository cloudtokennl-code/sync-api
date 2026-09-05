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

  const productUrl = `https://www.stuller.com/products/${series}/`;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // Laad de pagina en wacht extra voor JS-rendering
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 0 });
    await new Promise(r => setTimeout(r, 8000)); // wacht 8 seconden

    // Controleer meerdere mogelijke selectors
    const selectors = [
      '[data-test="specifications"] table.detailsTable',
      'table.detailsTable',
      '[data-test="product-specifications"] table'
    ];

    let found = false;
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 60000 });
        found = sel;
        break;
      } catch {}
    }

    if (!found) {
      await browser.close();
      return res.status(404).json({ error: "Specifications table not found" });
    }

    // Lees de specificaties uit
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
    }, found);

    await browser.close();

    // Opschonen → nette JSON keys
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
