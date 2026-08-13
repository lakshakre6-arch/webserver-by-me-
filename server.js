const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================================
// EXPRESS SETUP
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve files from /public
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// DEVICE STATE
// ============================================================

let ledState = false;

// Simple test OAuth storage
const authorizationCodes = new Map();
const refreshTokens = new Map();

// ============================================================
// HOME PAGE
// ============================================================

app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>ESP32 Smart Switch</title>
            <style>
                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    background: #0f172a;
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }

                .card {
                    width: 90%;
                    max-width: 400px;
                    background: #1e293b;
                    padding: 30px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }

                h1 {
                    margin-bottom: 10px;
                }

                .status {
                    font-size: 28px;
                    font-weight: bold;
                    margin: 25px 0;
                }

                button {
                    border: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    font-size: 18px;
                    cursor: pointer;
                    background: #3b82f6;
                    color: white;
                }

                button:hover {
                    background: #2563eb;
                }
            </style>
        </head>

        <body>
            <div class="card">
                <h1>ESP32 Smart Switch</h1>

                <div class="status" id="status">
                    Loading...
                </div>

                <button onclick="toggleLED()">
                    Toggle LED
                </button>
            </div>

            <script>
                async function updateStatus() {
                    try {
                        const response = await fetch("/api/led/status");
                        const data = await response.json();

                        document.getElementById("status").innerText =
                            "LED: " + data.status;
                    } catch (error) {
                        document.getElementById("status").innerText =
                            "Connection Error";
                    }
                }

                async function toggleLED() {
                    try {
                        await fetch("/api/led/toggle", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            }
                        });

                        updateStatus();
                    } catch (error) {
                        console.log(error);
                    }
                }

                updateStatus();

                setInterval(updateStatus, 1000);
            </script>
        </body>
        </html>
    `);
});

// ============================================================
// ESP32 / WEB DASHBOARD API
// ============================================================

// Get LED status
app.get("/api/led/status", (req, res) => {
    res.json({
        success: true,
        status: ledState ? "ON" : "OFF",
        state: ledState
    });
});

// Set/toggle LED
app.post("/api/led/toggle", (req, res) => {

    if (req.body && req.body.state !== undefined) {
        ledState = Boolean(req.body.state);
    } else {
        ledState = !ledState;
    }

    console.log("LED state changed:", ledState);

    res.json({
        success: true,
        status: ledState ? "ON" : "OFF",
        state: ledState
    });
});

// Explicit ON
app.post("/api/led/on", (req, res) => {
    ledState = true;

    console.log("LED ON");

    res.json({
        success: true,
        status: "ON",
        state: true
    });
});

// Explicit OFF
app.post("/api/led/off", (req, res) => {
    ledState = false;

    console.log("LED OFF");

    res.json({
        success: true,
        status: "OFF",
        state: false
    });
});

// ============================================================
// GOOGLE HOME OAUTH AUTHORIZATION
// ============================================================

app.get(["/auth", "/oauth/authorize"], (req, res) => {

    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;

    console.log("OAuth authorization request");
    console.log("redirect_uri:", redirectUri);
    console.log("state:", state);

    if (!redirectUri || !state) {
        return res.status(400).send(`
            <h2>OAuth Error</h2>
            <p>Missing redirect_uri or state.</p>
        `);
    }

    // Create temporary authorization code
    const code =
        "auth_code_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2);

    authorizationCodes.set(code, {
        userId: "esp32_user_1",
        createdAt: Date.now()
    });

    const targetUrl =
        redirectUri +
        "?code=" +
        encodeURIComponent(code) +
        "&state=" +
        encodeURIComponent(state);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>ESP32 Smart Switch</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #0f172a;
                    color: white;
                    text-align: center;
                    padding: 50px 20px;
                }

                .card {
                    max-width: 400px;
                    margin: auto;
                    background: #1e293b;
                    padding: 30px;
                    border-radius: 20px;
                }

                .button {
                    display: inline-block;
                    background: #3b82f6;
                    color: white;
                    text-decoration: none;
                    padding: 14px 25px;
                    border-radius: 10px;
                    margin-top: 20px;
                    font-weight: bold;
                }
            </style>
        </head>

        <body>

            <div class="card">

                <h1>ESP32 Smart Switch</h1>

                <p>
                    Your Google Home account is ready
                    to connect with the ESP32 Smart Switch.
                </p>

                <a class="button" href="${targetUrl}">
                    Continue
                </a>

            </div>

            <script>
                setTimeout(function() {
                    window.location.href =
                        "${targetUrl}";
                }, 1000);
            </script>

        </body>
        </html>
    `);
});

// ============================================================
// GOOGLE HOME TOKEN ENDPOINT
// ============================================================

app.post(["/token", "/oauth/token"], (req, res) => {

    const grantType = req.body.grant_type;
    const code = req.body.code;
    const refreshToken = req.body.refresh_token;

    console.log("Token request");
    console.log("grant_type:", grantType);

    // --------------------------------------------------------
    // Authorization Code -> Access Token
    // --------------------------------------------------------

    if (grantType === "authorization_code") {

        if (!code || !authorizationCodes.has(code)) {
            return res.status(400).json({
                error: "invalid_grant"
            });
        }

        const user = authorizationCodes.get(code);

        // Remove code so it cannot be reused
        authorizationCodes.delete(code);

        const accessToken =
            "access_token_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substring(2);

        const newRefreshToken =
            "refresh_token_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substring(2);

        refreshTokens.set(newRefreshToken, {
            userId: user.userId
        });

        return res.json({
            token_type: "Bearer",
            access_token: accessToken,
            refresh_token: newRefreshToken,
            expires_in: 3600
        });
    }

    // --------------------------------------------------------
    // Refresh Token -> New Access Token
    // --------------------------------------------------------

    if (grantType === "refresh_token") {

        if (!refreshToken || !refreshTokens.has(refreshToken)) {
            return res.status(400).json({
                error: "invalid_grant"
            });
        }

        const accessToken =
            "access_token_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substring(2);

        return res.json({
            token_type: "Bearer",
            access_token: accessToken,
            expires_in: 3600
        });
    }

    return res.status(400).json({
        error: "unsupported_grant_type"
    });
});

// ============================================================
// GOOGLE HOME SMART HOME FULFILLMENT
// ============================================================

app.post("/smarthome", (req, res) => {

    try {

        const body = req.body;

        console.log("=================================");
        console.log("Google Home Request");
        console.log(JSON.stringify(body, null, 2));
        console.log("=================================");

        if (!body || !body.inputs || !body.inputs.length) {
            return res.status(400).json({
                errorCode: "INVALID_REQUEST"
            });
        }

        const input = body.inputs[0];

        // ====================================================
        // SYNC
        // ====================================================

        if (input.intent === "action.devices.SYNC") {

            return res.json({
                requestId: body.requestId,

                payload: {

                    agentUserId: "esp32_user_1",

                    devices: [

                        {
                            id: "esp32_switch_1",

                            type: "action.devices.types.SWITCH",

                            traits: [
                                "action.devices.traits.OnOff"
                            ],

                            name: {
                                defaultNames: [
                                    "ESP32 Smart Switch"
                                ],

                                name: "Smart Switch",

                                nicknames: [
                                    "Switch",
                                    "ESP32 Switch"
                                ]
                            },

                            willReportState: false,

                            attributes: {}
                        }

                    ]
                }
            });
        }

        // ====================================================
        // QUERY
        // ====================================================

        if (input.intent === "action.devices.QUERY") {

            const devices = {};

            const requestedDevices =
                input.payload.devices || [];

            for (const device of requestedDevices) {

                if (device.id === "esp32_switch_1") {

                    devices[device.id] = {

                        on: ledState,

                        online: true
                    };
                }
            }

            return res.json({

                requestId: body.requestId,

                payload: {
                    devices: devices
                }
            });
        }

        // ====================================================
        // EXECUTE
        // ====================================================

        if (input.intent === "action.devices.EXECUTE") {

            const commands =
                input.payload.commands || [];

            const results = [];

            for (const command of commands) {

                const executions =
                    command.execution || [];

                const devices =
                    command.devices || [];

                for (const execution of executions) {

                    if (
                        execution.command ===
                        "action.devices.commands.OnOff"
                    ) {

                        const newState =
                            Boolean(execution.params.on);

                        ledState = newState;

                        console.log(
                            "Google Home changed LED:",
                            ledState ? "ON" : "OFF"
                        );

                        results.push({

                            ids: devices.map(
                                device => device.id
                            ),

                            status: "SUCCESS",

                            states: {
                                on: ledState,
                                online: true
                            }
                        });
                    }
                }
            }

            return res.json({

                requestId: body.requestId,

                payload: {
                    commands: results
                }
            });
        }

        // ====================================================
        // DISCONNECT
        // ====================================================

        if (
            input.intent ===
            "action.devices.DISCONNECT"
        ) {

            console.log(
                "Google Home account disconnected"
            );

            return res.json({});
        }

        // ====================================================
        // UNKNOWN INTENT
        // ====================================================

        return res.status(400).json({
            errorCode: "UNKNOWN_INTENT"
        });

    } catch (error) {

        console.error(
            "Smart Home Error:",
            error
        );

        return res.status(500).json({
            errorCode: "INTERNAL_ERROR"
        });
    }
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", (req, res) => {

    res.json({
        status: "OK",
        server: "ESP32 Smart Home Server",
        led: ledState ? "ON" : "OFF",
        uptime: process.uptime()
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("=================================");
    console.log("ESP32 Smart Home Server Started");
    console.log("=================================");
    console.log("Port:", PORT);
    console.log("LED:", ledState ? "ON" : "OFF");
    console.log("Health: /health");
    console.log("Smart Home: /smarthome");
    console.log("=================================");
});
