const nodemailer = require("nodemailer");

// Always create a fresh transporter reading from current env vars
// Do NOT cache it — env vars must always be fresh at send time
const getTransporter = () => {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = port === 465; // true for 465, false for other ports like 587
    return nodemailer.createTransport({
        host: (process.env.SMTP_HOST || "smtp.gmail.com").trim(),
        port,
        secure,
        auth: {
            user: (process.env.SMTP_USER || "").trim(),
            pass: (process.env.SMTP_PASS || "").trim(),
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
};

/**
 * Send OTP email with a professional HTML template.
 */
const sendOTPEmail = async (to, username, otp) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>PingMe – Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
              <tr>
                <td style="background:#fff;border-radius:12px;width:52px;height:52px;text-align:center;vertical-align:middle;">
                  <span style="font-size:28px;line-height:52px;">💬</span>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">PingMe</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Secure Password Reset</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">Hi ${username},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              We received a request to reset your PingMe password. Use the OTP below to continue. It expires in <strong>10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:28px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      ${otp.split("").map(d => `
                      <td style="
                        width:52px;height:64px;
                        text-align:center;vertical-align:middle;
                        font-size:30px;font-weight:900;color:#000;
                        background:#f8f8f8;
                        border:2px solid #e0e0e0;
                        border-radius:10px;
                        margin:0 4px;
                        padding:0 4px;
                      ">${d}</td>
                      `).join("")}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:#888;text-align:center;">
              Do not share this OTP with anyone. PingMe will never ask for it.
            </p>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>

            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">
              If you didn't request this, you can safely ignore this email. Your account is secure.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PingMe. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log(`[Mailer] Sending OTP email to: ${to} (from: ${(process.env.SMTP_USER || "").trim()})`);
    
    const transporter = getTransporter();
    const info = await transporter.sendMail({
        from: `"PingMe" <${(process.env.SMTP_USER || "").trim()}>`,
        to,
        subject: `${otp} is your PingMe password reset OTP`,
        html,
    });
    
    console.log(`[Mailer] ✅ Email sent successfully! MessageId: ${info.messageId}, Accepted: ${info.accepted}, Rejected: ${info.rejected}`);
    return info;
};

const sendFeedbackEmail = async (userEmail, username, rating, workingWell, needsChange) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>New Feedback Received</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:#000;padding:24px 32px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">PingMe Feedback</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111;">New Feedback Response</p>
            <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 0;font-weight:600;color:#555;width:35%;">User:</td>
                <td style="padding:10px 0;color:#111;">${username} (${userEmail})</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 0;font-weight:600;color:#555;">Rating:</td>
                <td style="padding:10px 0;font-size:18px;color:#f39c12;">${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)</td>
              </tr>
            </table>

            <div style="margin-bottom:20px;background:#f9f9f9;padding:16px;border-radius:8px;border-left:4px solid #2196F3;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#555;text-transform:uppercase;">What is working well:</p>
              <p style="margin:0;font-size:14px;color:#111;line-height:1.5;">${workingWell || "<em>No response provided</em>"}</p>
            </div>

            <div style="margin-bottom:8px;background:#f9f9f9;padding:16px;border-radius:8px;border-left:4px solid #f44336;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#555;text-transform:uppercase;">What needs to change / improve:</p>
              <p style="margin:0;font-size:14px;color:#111;line-height:1.5;">${needsChange || "<em>No response provided</em>"}</p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PingMe support team.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log(`[Mailer] Sending Feedback email to supportpingmechat@gmail.com`);
    
    try {
        const transporter = getTransporter();
        const info = await transporter.sendMail({
            from: `"PingMe Feedback" <${(process.env.SMTP_USER || "").trim()}>`,
            to: "supportpingmechat@gmail.com",
            subject: `Feedback from ${username} - ${rating}/5 Stars`,
            html,
        });
        console.log(`[Mailer] Feedback email sent: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error("[Mailer] Failed to send feedback email:", err.message);
    }
};

const sendVerificationEmail = async (to, username, otp) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Verify your PingMe Email</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:#000;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">PingMe</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Email Verification</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111;">Welcome ${username}!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              Thank you for registering at PingMe. Please verify your email address by entering the 6-digit OTP code below. It is valid for <strong>10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:28px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      ${otp.split("").map(d => `
                      <td style="
                        width:42px;height:52px;
                        text-align:center;vertical-align:middle;
                        font-size:28px;font-weight:900;color:#000;
                        background:#f8f8f8;
                        border:2px solid #e0e0e0;
                        border-radius:10px;
                        margin:0 4px;
                        padding:0 4px;
                      ">${d}</td>
                      `).join("")}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>

            <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">
              If you did not sign up for a PingMe account, please ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PingMe. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log(`[Mailer] Sending verification email to: ${to}`);
    
    try {
        const transporter = getTransporter();
        const info = await transporter.sendMail({
            from: `"PingMe" <${(process.env.SMTP_USER || "").trim()}>`,
            to,
            subject: `${otp} is your PingMe verification code`,
            html,
        });
        console.log(`[Mailer] Verification email sent: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error("[Mailer] Failed to send verification email:", err.message);
    }
};

module.exports = { sendOTPEmail, sendFeedbackEmail, sendVerificationEmail };
