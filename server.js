import express from "express";
import puppeteer from "puppeteer";

const app = express();

function cleanKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

app.get("/fetch", async (req, res) => {
  const series = req.query.url; // hier geef je alleen het serienummer mee
  if (!series) return res.status(400).json({ error: "Missing series number" });

  const productUrl = `https://www.stuller.com/products/${series}/`;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(productUrl, { waitUntil: "networkidle2", timeout: 0 });

    // wacht op specificatietabel
    const selector = '[data-test="specifications"] table.detailsTable';
    await page.waitForSelector(selector, { timeout: 60000 });

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
