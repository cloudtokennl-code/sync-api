import express from "express";
import puppeteer from "puppeteer";

const app = express();

app.get("/fetch", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL parameter" });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    await page.waitForSelector('[data-test="specifications"] table.detailsTable');

    const specs = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        '[data-test="specifications"] table.detailsTable tr'
      );
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
    });

    await browser.close();
    res.json(specs);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Puppeteer API running on port 3000");
});
