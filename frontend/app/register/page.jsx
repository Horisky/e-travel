"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function RegisterPage() {
  const router = useRouter();
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000", []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestCode = async () => {
    setMessage("");
    if (!email.trim()) {
      setMessage("请填写邮箱");
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
      if (!resp.ok) throw new Error(data.detail || "发送失败");
      setMessage(data.code ? `测试模式验证码：${data.code}` : "验证码已发送，请查看邮箱");
      setCooldown(60);
    } catch (err) {
      setMessage(err.message || "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    setMessage("");
    if (!email.trim()) {
      setMessage("请填写邮箱");
      return;
    }
    if (!passwordRule.test(password)) {
      setMessage("密码需包含大写字母、小写字母、特殊符号且不少于8位");
      return;
    }
    if (password !== confirm) {
      setMessage("两次输入的密码不一致");
      return;
    }
    if (!code.trim()) {
      setMessage("请输入邮箱验证码");
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
      if (!resp.ok) throw new Error(data.detail || "注册失败");
      localStorage.setItem("e_travel_token", data.token);
      localStorage.setItem("e_travel_email", data.email || email);
      router.replace("/planner");
    } catch (err) {
      setMessage(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>创建账号</h1>
        <p className="muted">注册后可保存偏好与行程</p>

        <div className="auth-body">
          <div className="field">
            <label>邮箱</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>确认密码</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="field">
            <label>邮箱验证码</label>
            <div className="inline">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6位验证码" />
              <button className="ghost-button" type="button" onClick={requestCode} disabled={cooldown > 0 || loading}>
                {cooldown > 0 ? `重新发送（${cooldown}s）` : "发送验证码"}
              </button>
            </div>
          </div>
          <button className="submit" type="button" onClick={register} disabled={loading}>注册</button>
          <button className="ghost-button" type="button" onClick={() => router.push("/")}>返回登录</button>
          {message ? <p className="hint">{message}</p> : null}
          <p className="hint">密码规则：至少8位，包含大写字母、小写字母、特殊符号</p>
        </div>
      </div>
    </div>
  );
}
