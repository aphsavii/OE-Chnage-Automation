import puppeteer from "puppeteer";

const regno = process.env.REGNO ;
const password = process.env.PASSWORD;

export async function runAutomation() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    // await notify(`✅ Registration Opened!!! Hurry up`);
    while (true) {
        console.log(`\n🔁 New session started at ${new Date().toLocaleString()}...\n`);
        const page = await browser.newPage();

        try {
            await login(page);
            
            const registrationPageUrl = await getSemesterRegPageUrl(page);
            if (!registrationPageUrl) {
                console.log("❌ Could not find Semester Registration link.");
                await page.close();
                await delay(5000);
                continue;
            }

            await page.goto(registrationPageUrl, { waitUntil: "networkidle0" });

            // OE polling loop
            let refreshCount = 0;
            while (true) {
                if(refreshCount>= 20) {
                    console.log("🔄 Refresh limit reached. Restarting from login...");
                    break; // restart outer loop
                }
                const oeId = await checkAvailableOE(page);
                if (oeId) {
                    await notify(`✅ Registration Opened!!! Hurry up`);
                    console.log(`✅ OE available: ${oeId}`);
                    const changed = await changeSubject(page, oeId);
                    if (changed) {
                        console.log("🎉 Subject changed and saved successfully.");
                        await page.close();
                        await browser.close(); // ✅ Exit browser after success
                        return; // ✅ Exit entire script
                    } else {
                        console.log("⚠️ Failed to change subject. Restarting from login...");
                        break; // restart outer loop
                    }
                } else {
                    console.log("🔁 OE not available. Refreshing...");
                }
                refreshCount++;
                await refreshRegistrationPage(page, registrationPageUrl);
                await delay(5000); // wait before next refresh
            }

        } catch (err) {
            console.error("❌ Error occurred:", err.message);
        }

        await page.close(); // clean up page after failure
        await delay(3000);  // short wait before retry
    }
}

// === Login ===
async function login(page) {
    await page.goto("http://14.139.242.71:8085/Login.aspx", {
        waitUntil: "domcontentloaded"
    });

    await page.type("#txtuser", regno);
    await page.type('input[name="psw"]', password);

    await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        page.click("#btnlogin")
    ]);

    const profileInfo = await page.$(".profile_info");
    if (profileInfo) {
        const text = await page.evaluate(el => el.textContent.trim(), profileInfo);
        console.log("✅ Login successful. Profile Info:", text);
    } else {
        throw new Error("Login failed.");
    }
}

// === Get Semester Registration Page URL ===
async function getSemesterRegPageUrl(page) {
    const links = await page.$$("a");
    for (const link of links) {
        const text = await page.evaluate(el => el.textContent.trim(), link);
        if (text.toLowerCase().includes("semester registration")) {
            return await page.evaluate(el => el.href, link);
        }
    }
    return null;
}

// === Refresh Registration Page ===
async function refreshRegistrationPage(page, url) {
    try {
        await page.goto(url, { waitUntil: "networkidle0" });
        page.once("dialog", async dialog => {
            console.log("💾 Save alert:", dialog.message());
            await dialog.accept();
        });
        console.log("🔄 Page refreshed.");
    } catch (err) {
        console.error("❌ Failed to refresh page:", err);
    }
}

// === Check Available OE Subjects ===
async function checkAvailableOE(page) {
    const oeIds = [
        'TabContainer1_TabPanel11_grdsubject_ChkIn_10',
        'TabContainer1_TabPanel11_grdsubject_ChkIn_22'
    ];

    for (const id of oeIds) {
        try {
            await page.waitForSelector(`#${id}`, { timeout: 3000 });
            const isEnabled = await page.$eval(`#${id}`, el => !el.disabled);
            if (isEnabled) return id;
        } catch {
            // Not found or disabled
        }
    }
    return null;
}

// === Change Subject (Delete + Select + Save) ===
async function changeSubject(page, checkboxId) {
    try {
        const deleteBtn = await page.$("#TabContainer1_TabPanel11_grddeleted_btnselect_4");
        if (deleteBtn) {
            page.once("dialog", async dialog => {
                console.log("🗑️ Delete alert:", dialog.message());
                await dialog.accept();
            });
            await deleteBtn.click();
            console.log("🗑️ Deleted existing OE.");
            await delay(1000);
        }

        await page.waitForSelector(`#${checkboxId}`, { timeout: 5000 });
        const checkbox = await page.$(`#${checkboxId}`);
        if (!checkbox) {
            console.log("❌ OE checkbox not found after delete.");
            return false;
        }
        await checkbox.click();
        console.log(`✅ Selected OE checkbox: ${checkboxId}`);

        const saveBtnSelector = "#TabContainer1_TabPanel11_btnregularsubject";
        await page.waitForSelector(saveBtnSelector, { timeout: 5000 });
        const saveBtn = await page.$(saveBtnSelector);
        if (!saveBtn) {
            console.log("❌ Save button not found.");
            return false;
        }

        page.once("dialog", async dialog => {
            console.log("💾 Save alert:", dialog.message());
            await dialog.accept();
        });

        await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            saveBtn.click()
        ]);

        return true;

    } catch (err) {
        console.error("❌ Error during subject change:", err);
        return false;
    }
}

// === Delay Utility ===
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

async function notify(message) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message
    })
  });

  const data = await res.json();
  console.log(data);
}