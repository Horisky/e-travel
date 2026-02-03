"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function LoginPage() {
  const router = useRouter();
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
      setStatus("请填写邮箱", "error");
      return false;
    }
    return true;
  };

  const login = async () => {
    clearMessage();
    if (!ensureEmail()) return;
    if (!password) {
      setStatus("请输入密码", "error");
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
      if (!resp.ok) throw new Error(data.detail || "登录失败");
      handleAuthSuccess(data);
    } catch (err) {
      setStatus(err.message || "登录失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async (purpose) => {
    clearMessage();
    if (!ensureEmail()) return;
    if (cooldown > 0) {
      setStatus(`请稍后再试（${cooldown}s）`, "error");
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
      if (!resp.ok) throw new Error(data.detail || "发送失败");
      setStatus(data.code ? `测试模式验证码：${data.code}` : "验证码已发送，请查看邮箱");
      setCooldown(60);
    } catch (err) {
      setStatus(err.message || "发送失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyCodeLogin = async () => {
    clearMessage();
    if (!ensureEmail()) return;
    if (!code.trim()) {
      setStatus("请输入验证码", "error");
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
      if (!resp.ok) throw new Error(data.detail || "验证码无效");
      handleAuthSuccess(data);
    } catch (err) {
      setStatus(err.message || "验证码无效", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    clearMessage();
    if (!ensureEmail()) return;
    if (!code.trim()) {
      setStatus("请输入验证码", "error");
      return;
    }
    if (!passwordRule.test(newPassword)) {
      setStatus("新密码需包含大写字母、小写字母、特殊符号且不少于8位", "error");
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
      if (!resp.ok) throw new Error(data.detail || "重置失败");
      setStatus("密码重置成功，请使用新密码登录");
    } catch (err) {
      setStatus(err.message || "重置失败", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>登录 E-Travel</h1>
        <p className="muted">使用邮箱 + 密码或邮箱验证码登录</p>

        <div className="auth-tabs">
          <button type="button" className={tab === "password" ? "tab active" : "tab"} onClick={() => setTab("password")}>密码登录</button>
          <button type="button" className={tab === "code" ? "tab active" : "tab"} onClick={() => setTab("code")}>验证码登录</button>
        </div>

        <div className="auth-body">
          <div className="field">
            <label>邮箱</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          {tab === "password" ? (
            <>
              <div className="field">
                <label>密码</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="submit" type="button" onClick={login} disabled={loading}>登录</button>
              <button className="ghost-button" type="button" onClick={() => router.push("/register")}>注册新账号</button>

              <div className="reset-block">
                <button
                  className="link"
                  type="button"
                  onClick={() => setShowReset((prev) => !prev)}
                >
                  {showReset ? "取消重置密码" : "忘记密码？"}
                </button>
                {showReset ? (
                  <div className="reset-block">
                    <button className="ghost-button" type="button" onClick={() => requestCode("reset")} disabled={cooldown > 0 || loading}>
                      {cooldown > 0 ? `重新发送（${cooldown}s）` : "发送验证码"}
                    </button>
                    <div className="inline">
                      <input placeholder="验证码" value={code} onChange={(e) => setCode(e.target.value)} />
                      <input type="password" placeholder="新密码" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      <button className="ghost-button" type="button" onClick={resetPassword} disabled={loading}>重置密码</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <button className="ghost-button" type="button" onClick={() => requestCode("login")} disabled={cooldown > 0 || loading}>
                {cooldown > 0 ? `重新发送（${cooldown}s）` : "发送验证码"}
              </button>
              <div className="field">
                <label>验证码</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6位验证码" />
              </div>
              <button className="submit" type="button" onClick={verifyCodeLogin} disabled={loading}>登录</button>
              <button className="ghost-button" type="button" onClick={() => router.push("/register")}>注册新账号</button>
            </>
          )}

          {message ? <p className={messageType === "error" ? "hint error" : "hint"}>{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
