"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../components/LanguageProvider";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function RegisterPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000", []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
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
        "Invalid code": "验证码无效",
        "Email already registered": "邮箱已注册",
        "User not found": "用户不存在",
        "Failed to send email": "发送邮件失败",
        "Invalid token": "登录已过期，请重新登录",
        "Unauthorized": "请先登录",
        "Invalid Authorization header": "登录信息无效"
      },
      en: {
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
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestCode = async () => {
    clearMessage();
    if (!email.trim()) {
      setStatus(lang === "zh" ? "请填写邮箱" : "Please enter email", "error");
      return;
    }
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/auth/register/request`, {
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

  const register = async () => {
    clearMessage();
    if (!email.trim()) {
      setStatus(lang === "zh" ? "请填写邮箱" : "Please enter email", "error");
      return;
    }
    if (!passwordRule.test(password)) {
      setStatus(
        lang === "zh"
          ? "密码需包含大写字母、小写字母、特殊符号且不少于8位"
          : "Password must include upper, lower, special char and be 8+ characters",
        "error"
      );
      return;
    }
    if (password !== confirm) {
      setStatus(lang === "zh" ? "两次输入的密码不一致" : "Passwords do not match", "error");
      return;
    }
    if (!code.trim()) {
      setStatus(lang === "zh" ? "请输入邮箱验证码" : "Please enter email code", "error");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || (lang === "zh" ? "注册失败" : "Register failed"));
      localStorage.setItem("e_travel_token", data.token);
      localStorage.setItem("e_travel_email", data.email || email);
      router.replace("/planner");
    } catch (err) {
      setStatus(toUiMessage(err.message) || (lang === "zh" ? "注册失败" : "Register failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t("register.title")}</h1>
        <p className="muted">{t("register.subtitle")}</p>

        <div className="auth-body">
          <div className="field">
            <label>{t("login.email")}</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>{t("login.password")}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>{lang === "zh" ? "确认密码" : "Confirm password"}</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="field">
            <label>{lang === "zh" ? "邮箱验证码" : "Email code"}</label>
            <div className="inline">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={lang === "zh" ? "6位验证码" : "6-digit code"} />
              <button className="ghost-button" type="button" onClick={requestCode} disabled={cooldown > 0 || loading}>
                {cooldown > 0 ? `${t("login.resend")}（${cooldown}s）` : t("login.sendCode")}
              </button>
            </div>
          </div>
          <button className="submit" type="button" onClick={register} disabled={loading}>{t("register.submit")}</button>
          <button className="ghost-button" type="button" onClick={() => router.push("/")}>{t("register.back")}</button>
          {message ? <p className={messageType === "error" ? "hint error" : "hint"}>{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
