const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Render provides the PORT through the environment.
// 10000 is used when running locally.
const PORT = process.env.PORT || 10000;

// Smart switch state
let switchState = false;
let lastUpdated = new Date().toISOString();

function updateState(value) {
  switchState = Boolean(value);
  lastUpdated = new Date().toISOString();
}


// =====================================================
// MAIN DASHBOARD
// =====================================================

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Smart Switch Dashboard</title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      display: flex;
      justify-content: center;
      align-items: center;

      font-family: Arial, sans-serif;

      background: linear-gradient(
        135deg,
        #101828,
        #1d2939
      );

      color: white;
    }

    .card {
      width: min(92%, 520px);

      padding: 35px;

      text-align: center;

      border-radius: 24px;

      background: rgba(255, 255, 255, 0.10);

      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.30);

      backdrop-filter: blur(12px);
    }

    h1 {
      margin-top: 0;
      font-size: 36px;
    }

    .subtitle {
      opacity: 0.75;
      margin-bottom: 30px;
    }

    .state {
      font-size: 48px;
      font-weight: bold;

      margin: 30px 0;
    }

    button {
      border: none;

      border-radius: 14px;

      padding: 15px 30px;

      margin: 6px;

      font-size: 17px;

      cursor: pointer;

      transition: transform 0.2s;
    }

    button:hover {
      transform: scale(1.05);
    }

    .on {
      background: #12b76a;
      color: white;
    }

    .off {
      background: #f04438;
      color: white;
    }

    .info {
      margin-top: 25px;

      opacity: 0.75;

      font-size: 14px;
    }

  </style>

</head>

<body>

  <div class="card">

    <h1>Smart Switch</h1>

    <div class="subtitle">
      ESP32 Smart Switch Control
    </div>

    <div id="state" class="state">
      Loading...
    </div>

    <button
      class="on"
      onclick="setSwitch(true)">
      TURN ON
    </button>

    <button
      class="off"
      onclick="setSwitch(false)">
      TURN OFF
    </button>

    <div id="info" class="info">
      Connecting to server...
    </div>

  </div>


<script>

async function loadStatus() {

  try {

    const response = await fetch("/status");

    const data = await response.json();

    const stateElement =
      document.getElementById("state");

    const infoElement =
      document.getElementById("info");


    if (data.on) {

      stateElement.textContent = "ON";

    } else {

      stateElement.textContent = "OFF";

    }


    infoElement.textContent =
      "Last updated: " +
      new Date(data.lastUpdated).toLocaleString();

  }

  catch (error) {

    document.getElementById("state")
      .textContent = "Server Error";

    document.getElementById("info")
      .textContent = "Unable to connect to server.";

  }

}


async function setSwitch(value) {

  try {

    await fetch("/toggle", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        on: value
      })

    });

    loadStatus();

  }

  catch (error) {

    console.error(error);

  }

}


// Load status immediately
loadStatus();


// Automatically update every 1 second
setInterval(loadStatus, 1000);

</script>

</body>

</html>
  `);
});


// =====================================================
// STATUS ROUTE
// =====================================================

app.get("/status", (req, res) => {

  res.json({

    on: switchState,

    lastUpdated: lastUpdated

  });

});


// =====================================================
// TOGGLE ROUTE
// =====================================================

app.post("/toggle", (req, res) => {

  if (typeof req.body.on !== "undefined") {

    updateState(req.body.on);

  } else {

    updateState(!switchState);

  }


  res.json({

    success: true,

    on: switchState,

    lastUpdated: lastUpdated

  });

});


// =====================================================
// UPDATE ROUTE
// ESP32 can use this route
// =====================================================

app.post("/update", (req, res) => {

  if (typeof req.body.on === "undefined") {

    return res.status(400).json({

      success: false,

      error:
        'Send JSON like {"on":true} or {"on":false}'

    });

  }


  updateState(req.body.on);


  res.json({

    success: true,

    on: switchState,

    lastUpdated: lastUpdated

  });

});


// =====================================================
// OAUTH AUTHORIZE ROUTE
// =====================================================

app.get("/oauth/authorize", (req, res) => {

  res.status(501).json({

    error: "not_implemented",

    message:
      "OAuth authorization is not configured yet."

  });

});


// =====================================================
// OAUTH TOKEN ROUTE
// =====================================================

app.post("/oauth/token", (req, res) => {

  res.status(501).json({

    error: "not_implemented",

    message:
      "OAuth token exchange is not configured yet."

  });

});


// =====================================================
// GOOGLE SMART HOME FULFILLMENT
// =====================================================

app.post("/google-fulfillment", (req, res) => {

  res.status(501).json({

    error: "not_implemented",

    message:
      "Google Smart Home fulfillment is not configured yet."

  });

});


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {

  res.json({

    status: "ok"

  });

});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `Smart Switch Server running on port ${PORT}`
  );

});
