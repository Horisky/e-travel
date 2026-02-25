"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../components/LanguageProvider";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function LoginPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000", []);

  const [tab, setTab] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const clearMessage = () => {
    setMessage("");
    setMessageType("info");
  };

  const setStatus = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const toUiMessage = (raw) => {
    if (!raw) return raw;
    const map = {
      zh: {
        "Invalid credentials": "邮箱或密码错误",
        "Invalid code": "验证码无效",
        "Email already registered": "邮箱已注册",
        "User not found": "用户不存在",
        "Failed to send email": "发送邮件失败",
        "Invalid token": "登录已过期，请重新登录",
        "Unauthorized": "请先登录",
        "Invalid Authorization header": "登录信息无效"
      },
      en: {
        "Invalid credentials": "Invalid email or password",
        "Invalid code": "Invalid code",
        "Email already registered": "Email already registered",
        "User not found": "User not found",
        "Failed to send email": "Failed to send email",
        "Invalid token": "Login expired. Please login again.",
        "Unauthorized": "Please login first",
        "Invalid Authorization header": "Invalid login session"
      }
    };
    if (raw.startsWith("Resend error")) return lang === "zh" ? "邮件服务异常，请稍后再试" : "Email service error. Try again later.";
    return map[lang]?.[raw] || raw;
  };

  useEffect(() => {
    const token = localStorage.getItem("e_travel_token");
    if (token) router.replace("/planner");
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleAuthSuccess = (payload) => {
    localStorage.setItem("e_travel_token", payload.token);
    localStorage.setItem("e_travel_email", payload.email || email);
    router.replace("/planner");
  };

  const ensureEmail = () => {
    if (!email.trim()) {
      setStatus(lang === "zh" ? "请填写邮箱" : "Please enter email", "error");
      return false;
    }
    return true;
  };

  const login = async () => {
    clearMessage();
    if (!ensureEmail()) return;
    if (!password) {
      setStatus(lang === "zh" ? "请输入密码" : "Please enter password", "error");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || (lang === "zh" ? "登录失败" : "Login failed"));
      handleAuthSuccess(data);
    } catch (err) {
      setStatus(toUiMessage(err.message) || (lang === "zh" ? "登录失败" : "Login failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async (purpose) => {
    clearMessage();
    if (!ensureEmail()) return;
    if (cooldown > 0) {
      setStatus(lang === "zh" ? `请稍后再试（${cooldown}s）` : `Please try again (${cooldown}s)`, "error");
      return;
    }
    setLoading(true);
    try {
      const endpoint = purpose === "reset" ? "/api/auth/reset-password/request" : "/api/auth/login-code/request";
      const resp = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || (lang === "zh" ? "发送失败" : "Send failed"));
      setStatus(
        data.code
          ? (lang === "zh" ? `测试模式验证码：${data.code}` : `Dev code: ${data.code}`)
          : (lang === "zh" ? "验证码已发送，请查看邮箱" : "Code sent. Check your email.")
      );
      setCooldown(60);
    } catch (err) {
      setStatus(toUiMessage(err.message) || (lang === "zh" ? "发送失败" : "Send failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyCodeLogin = async () => {
    clearMessage();
    if (!ensureEmail()) return;
    if (!code.trim()) {
      setStatus(lang === "zh" ? "请输入验证码" : "Please enter code", "error");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/auth/login-code/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || (lang === "zh" ? "验证码无效" : "Invalid code"));
      handleAuthSuccess(data);
    } catch (err) {
      setStatus(toUiMessage(err.message) || (lang === "zh" ? "验证码无效" : "Invalid code"), "error");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    clearMessage();
    if (!ensureEmail()) return;
    if (!code.trim()) {
      setStatus(lang === "zh" ? "请输入验证码" : "Please enter code", "error");
      return;
    }
    if (!passwordRule.test(newPassword)) {
      setStatus(
        lang === "zh"
          ? "新密码需包含大写字母、小写字母、特殊符号且不少于8位"
          : "Password must include upper, lower, special char and be 8+ characters",
        "error"
      );
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/auth/reset-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || (lang === "zh" ? "重置失败" : "Reset failed"));
      setStatus(t("login.resetSuccess"));
    } catch (err) {
      setStatus(toUiMessage(err.message) || (lang === "zh" ? "重置失败" : "Reset failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t("login.title")}</h1>
        <p className="muted">{t("login.subtitle")}</p>

        <div className="auth-tabs">
          <button type="button" className={tab === "password" ? "tab active" : "tab"} onClick={() => setTab("password")}>{t("login.passwordTab")}</button>
          <button type="button" className={tab === "code" ? "tab active" : "tab"} onClick={() => setTab("code")}>{t("login.codeTab")}</button>
        </div>

        <div className="auth-body">
          <div className="field">
            <label>{t("login.email")}</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          {tab === "password" ? (
            <>
              <div className="field">
                <label>{t("login.password")}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="submit" type="button" onClick={login} disabled={loading}>{t("login.login")}</button>
              <button className="ghost-button" type="button" onClick={() => router.push("/register")}>{t("login.register")}</button>

              <div className="reset-block">
                <button
                  className="link"
                  type="button"
                  onClick={() => setShowReset((prev) => !prev)}
                >
                  {showReset ? t("login.cancelReset") : t("login.forgot")}
                </button>
                {showReset ? (
                  <div className="reset-block">
                    <button className="ghost-button" type="button" onClick={() => requestCode("reset")} disabled={cooldown > 0 || loading}>
                      {cooldown > 0 ? `${t("login.resend")}（${cooldown}s）` : t("login.sendCode")}
                    </button>
                    <div className="inline">
                      <input placeholder={t("login.code")} value={code} onChange={(e) => setCode(e.target.value)} />
                      <input type="password" placeholder={t("login.newPassword")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      <button className="ghost-button" type="button" onClick={resetPassword} disabled={loading}>{t("login.reset")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <button className="ghost-button" type="button" onClick={() => requestCode("login")} disabled={cooldown > 0 || loading}>
                {cooldown > 0 ? `${t("login.resend")}（${cooldown}s）` : t("login.sendCode")}
              </button>
              <div className="field">
                <label>{t("login.code")}</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={lang === "zh" ? "6位验证码" : "6-digit code"} />
              </div>
              <button className="submit" type="button" onClick={verifyCodeLogin} disabled={loading}>{t("login.login")}</button>
              <button className="ghost-button" type="button" onClick={() => router.push("/register")}>{t("login.register")}</button>
            </>
          )}

          {message ? <p className={messageType === "error" ? "hint error" : "hint"}>{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
