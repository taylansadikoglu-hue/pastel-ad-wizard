import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Check,
  Play,
  Search as SearchIcon,
  Layout,
  Share2,
  LogOut,
} from "lucide-react";

/* ---------- atoms ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: "var(--accent-gold)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function Logo({ size = 14 }: { size?: number }) {
  return (
    <span title="The agency world calls us R-AD." className="select-none">
      <span style={{ fontSize: size, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
        revenuad
      </span>
      <span style={{ fontSize: size, fontWeight: 600, color: "var(--accent-gold)" }}>.</span>
      <span style={{ fontSize: size, fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>
        signal
      </span>
    </span>
  );
}

function MetricCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div
      style={{
        background: "var(--surface-alt, #F0EDE8)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.03em" }}>
        {value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary, #9E9D94)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  body,
  pill,
  active = true,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  pill: string;
  active?: boolean;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderRadius: 10,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="flex items-center justify-between">
        <Icon size={20} color={active ? "#C9963A" : "#9E9D94"} strokeWidth={1.5} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: 4,
            border: active ? "1px solid #E8D5A0" : "1px solid #EBE9E4",
            background: active ? "#FDF6E8" : "#F0EDE8",
            color: active ? "#A07830" : "#9E9D94",
          }}
        >
          {pill}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{title}</div>
      <p style={{ fontSize: 13, color: "#6B6B62", lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
}

/* ---------- page ---------- */

export function Landing({ onEnter }: { onEnter: () => void }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast("Signed out");
  };

  const navLink: React.CSSProperties = {
    fontSize: 13,
    color: "#6B6B62",
    textDecoration: "none",
  };

  const primaryBtn: React.CSSProperties = {
    background: "#1C1C1A",
    color: "#FFFFFF",
    borderRadius: 7,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
  const secondaryBtn: React.CSSProperties = {
    background: "transparent",
    color: "#6B6B62",
    borderRadius: 7,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 500,
    border: "1px solid #EBE9E4",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", color: "#1C1C1A", fontFamily: "Inter, sans-serif" }}>
      {/* NAV */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #EBE9E4",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 32px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Logo />
          <nav className="hidden md:flex items-center" style={{ gap: 28 }}>
            <a href="#what-you-get" style={navLink}>What you get</a>
            <a href="#how" style={navLink}>How it works</a>
            <a href="#pricing" style={navLink}>Pricing</a>
            <a href="/auth" style={navLink}>Sign in</a>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <>
                <button onClick={onEnter} style={primaryBtn}>
                  Open workspace <ArrowRight size={14} />
                </button>
                <button onClick={signOut} style={secondaryBtn} aria-label="Sign out">
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <button onClick={onEnter} style={primaryBtn}>
                Start free <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 32px 64px" }}>
        <Eyebrow>Competitive signal for independent agencies</Eyebrow>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: "#1C1C1A",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            margin: 0,
            maxWidth: 760,
          }}
        >
          See exactly where
          <br />
          competitors are spending.
        </h1>
        <p
          style={{
            marginTop: 24,
            fontSize: 18,
            color: "#6B6B62",
            lineHeight: 1.6,
            maxWidth: 520,
          }}
        >
          R-AD tracks every paid ad across YouTube, Search, Display and Meta. Spend signals.
          Winning creatives. Market gaps. All before your next pitch.
        </p>
        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={onEnter} style={primaryBtn}>
            Start free trial <ArrowRight size={14} />
          </button>
          <a href="#how" style={{ ...secondaryBtn, textDecoration: "none" }}>
            See it in action
          </a>
        </div>

        {/* AUTHORITY STRIP */}
        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard value="18,000+" label="Ads tracked" sub="YouTube, Search & Display" />
          <MetricCard value="1,173" label="Brands monitored" sub="Across 30 AU categories" />
          <MetricCard value="30" label="Categories" sub="Banking to automotive" />
          <MetricCard value="$199" label="Per month" sub="Flat rate. No contracts." />
        </div>

        {/* EMPATHY BANNER */}
        <div
          style={{
            marginTop: 32,
            background: "#FDF6E8",
            border: "1px solid #E8D5A0",
            borderLeft: "3px solid #C9963A",
            borderRadius: 8,
            padding: "20px 24px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#A07830",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              We get it
            </div>
            <p style={{ fontSize: 15, color: "#1C1C1A", lineHeight: 1.6, margin: 0 }}>
              Agency life means pitching on Thursday for a brief that landed Wednesday. R-AD exists
              so you walk in knowing more than the client. Less prep. Better pitches.
            </p>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {["No analyst hours needed", "No annual contracts", "No more guessing"].map((line) => (
              <li key={line} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1C1C1A" }}>
                <Check size={14} color="#C9963A" strokeWidth={1.5} />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CHANNEL COVERAGE */}
      <section style={{ borderTop: "1px solid #EBE9E4", background: "#FFFFFF" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <Eyebrow>Where we read the signal</Eyebrow>
            <h2
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
                color: "#1C1C1A",
              }}
            >
              Every channel your competitors are hiding on.
            </h2>
            <p style={{ marginTop: 16, fontSize: 15, color: "#6B6B62", lineHeight: 1.6 }}>
              Legacy tools show you TV from last quarter. R-AD shows you what went live on YouTube this morning.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <ChannelCard
              icon={Play}
              title="YouTube"
              body="14,900+ video ads tracked. See how long each ad has been running, how many times it's been seen, and exactly what message it's pushing."
              pill="Live"
            />
            <ChannelCard
              icon={SearchIcon}
              title="Search"
              body="Paid search ads by brand and keyword. See who's bidding on your client's brand terms right now."
              pill="Live"
            />
            <ChannelCard
              icon={Layout}
              title="Programmatic"
              body="Display and banner ads across the open web. Where brands buy attention outside the walled gardens."
              pill="Live"
            />
            <ChannelCard
              icon={Share2}
              title="Meta"
              body="Facebook and Instagram ad library. Real spend ranges straight from Meta. Approval in progress."
              pill="Coming soon"
              active={false}
            />
          </div>
          <div
            style={{
              marginTop: 24,
              background: "#FDF6E8",
              border: "1px solid #E8D5A0",
              borderRadius: 8,
              padding: "12px 20px",
              fontSize: 13,
              color: "#A07830",
              textAlign: "center",
            }}
          >
            TikTok, LinkedIn and CTV signal arriving Q3 2026.
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section id="what-you-get" style={{ background: "#F7F6F3" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <Eyebrow>What you get</Eyebrow>
            <h2
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              The signal behind every winning pitch.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {[
              {
                n: "01",
                t: "Spend signal, not guesswork",
                b: "Stop presenting estimates from tools that admit they're guessing. R-AD reads ad frequency, placement patterns and impression data to give you a directional spend index. Honest. Defensible. Updated daily.",
                visual: (
                  <div>
                    <span style={{ color: "#C9963A", fontSize: 48, letterSpacing: 6 }}>●●●●○</span>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: "#9E9D94",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Spend index · High
                    </div>
                  </div>
                ),
              },
              {
                n: "02",
                t: "Creative read on every ad",
                b: "Every ad is analysed by GPT-4o Vision. Theme, message, CTA, demographic target, emotional angle — automatically tagged. No manual work. No analyst hours. Just signal.",
                visual: (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["Trust", "Home loans", "Rate offer", "Families", "Learn more"].map((p) => (
                      <span
                        key={p}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: 4,
                          background: "#FDF6E8",
                          border: "1px solid #E8D5A0",
                          color: "#A07830",
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                n: "03",
                t: "How long it's been running",
                b: "The best signal in advertising is duration. An ad running 90+ days is working. R-AD shows first seen, last seen, and impression count. You'll know what's performing before the client does.",
                visual: (
                  <div>
                    <div style={{ fontSize: 13, color: "#6B6B62", marginBottom: 8 }}>
                      Running 106 days
                    </div>
                    <div
                      style={{
                        background: "#F0EDE8",
                        borderRadius: 4,
                        height: 10,
                        width: "100%",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ background: "#C9963A", height: "100%", width: "75%" }} />
                    </div>
                  </div>
                ),
              },
              {
                n: "04",
                t: "The gap nobody's claimed yet",
                b: "R-AD automatically detects white space. Audiences competitors aren't targeting. Channels they're ignoring. Messages nobody owns. That's your pitch moment. That's why they'll hire you.",
                visual: (
                  <div
                    style={{
                      background: "#FDF6E8",
                      border: "1px solid #E8D5A0",
                      borderLeft: "3px solid #C9963A",
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#A07830",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Opportunity detected
                    </div>
                    <p style={{ fontSize: 13, color: "#1C1C1A", margin: "6px 0 0", lineHeight: 1.5 }}>
                      No competitor is targeting first-home buyers on YouTube. Open territory.
                    </p>
                  </div>
                ),
              },
              {
                n: "05",
                t: "Pitch deck in one click",
                b: "Walk in with a client-ready competitive deck. Six slides, auto-generated from live signal data. Done before your morning coffee.",
                visual: (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["6 slides", "Auto-generated", "One click"].map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: 4,
                          background: "#F0EDE8",
                          border: "1px solid #EBE9E4",
                          color: "#6B6B62",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ),
              },
            ].map((row, i) => {
              const reverse = i % 2 === 1;
              return (
                <div
                  key={row.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                    gap: 32,
                    alignItems: "center",
                    background: "#FFFFFF",
                    border: "1px solid #EBE9E4",
                    borderRadius: 10,
                    padding: 28,
                  }}
                >
                  <div style={{ order: reverse ? 2 : 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "#9E9D94",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 8,
                      }}
                    >
                      {row.n}
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#1C1C1A" }}>{row.t}</h3>
                    <p style={{ marginTop: 10, fontSize: 14, color: "#6B6B62", lineHeight: 1.6 }}>{row.b}</p>
                  </div>
                  <div style={{ order: reverse ? 1 : 2 }}>{row.visual}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ background: "#FFFFFF", borderTop: "1px solid #EBE9E4" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <Eyebrow>How it works</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>
              Domain to deck in three steps.
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                n: "Step 1",
                t: "Enter a domain",
                b: "Type commbank.com.au. R-AD pulls every active paid ad across every tracked channel. Takes minutes.",
              },
              {
                n: "Step 2",
                t: "Read the signal",
                b: "Spend index. Active channels. Creative themes. Audience gaps. Everything in one view. No translation needed.",
              },
              {
                n: "Step 3",
                t: "Win the pitch",
                b: "One click. Six slides. Client-ready. Walk in knowing more than the room.",
              },
            ].map((s) => (
              <div
                key={s.n}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #EBE9E4",
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#9E9D94",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#1C1C1A" }}>{s.t}</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#6B6B62", lineHeight: 1.6 }}>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUTHORITY */}
      <section style={{ background: "#F7F6F3" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <Eyebrow>Built for Australia</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>
              The signal your clients don't know you have.
            </h2>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: 32,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
              gap: 32,
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 18,
                  fontStyle: "italic",
                  color: "#1C1C1A",
                  lineHeight: 1.5,
                  margin: 0,
                  fontFamily: "Georgia, serif",
                }}
              >
                "Independent agencies spend hours building competitive decks that enterprise teams
                get from tools costing $20,000 a year. Not anymore."
              </p>
              <div style={{ marginTop: 16, fontSize: 11, color: "#9E9D94" }}>
                RevenuAD Signal · Built in Australia
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { t: "30 categories tracked", b: "Banking · Auto · Telco · Retail · Health and 25 more" },
                { t: "Fresh signal daily", b: "Updated every morning at 3am AEST" },
                { t: "Built for independent agencies", b: "Flat $199 a month. No category fees. No annual contract." },
              ].map((s, i) => (
                <div
                  key={s.t}
                  style={{
                    paddingBottom: 16,
                    borderBottom: i < 2 ? "1px solid #F0EDE8" : "none",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4, lineHeight: 1.5 }}>{s.b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: "#FFFFFF", borderTop: "1px solid #EBE9E4" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <Eyebrow>Pricing</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>
              Three plans. No contracts.
            </h2>
            <p style={{ marginTop: 12, fontSize: 15, color: "#6B6B62" }}>
              Because agency life has enough locked-in commitments.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                name: "Solo Signal",
                price: "$199",
                sub: "1 competitor tracked",
                perks: [
                  "Daily signal refresh",
                  "Creative read on every ad",
                  "Spend index + trend",
                  "Gap detection",
                  "PDF export",
                ],
                cta: "Claim your seat →",
                featured: false,
                action: "enter" as const,
              },
              {
                name: "Agency Signal",
                price: "$799",
                sub: "Up to 7 competitors tracked",
                badge: "Most popular",
                perks: [
                  "Everything in Solo Signal",
                  "Side-by-side benchmarks",
                  "Channel allocation breakdown",
                  "Longest-running creative leaders",
                  "Priority refresh",
                  "Slides export",
                ],
                cta: "Claim your seat →",
                featured: true,
                action: "enter" as const,
              },
              {
                name: "White Label",
                price: "$2,999",
                sub: "Unlimited competitors",
                perks: [
                  "Everything in Agency Signal",
                  "Your branding on every export",
                  "Custom domain",
                  "Dedicated onboarding",
                  "SLA + priority support",
                ],
                cta: "Talk to us →",
                featured: false,
                action: "mail" as const,
              },
            ].map((p) => (
              <div
                key={p.name}
                style={{
                  background: "#FFFFFF",
                  border: p.featured ? "2px solid #1C1C1A" : "1px solid #EBE9E4",
                  borderRadius: 10,
                  padding: 24,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {p.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: 24,
                      background: "#1C1C1A",
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "4px 12px",
                      borderRadius: 3,
                    }}
                  >
                    {p.badge}
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{p.name}</div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 40, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.03em" }}>
                    {p.price}
                  </span>
                  <span style={{ fontSize: 13, color: "#9E9D94" }}>/mo</span>
                </div>
                <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4 }}>{p.sub}</div>
                <ul style={{ listStyle: "none", margin: "20px 0 24px", padding: 0, display: "grid", gap: 8 }}>
                  {p.perks.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#1C1C1A" }}>
                      <Check size={14} color="#C9963A" strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "auto" }}>
                  {p.action === "mail" ? (
                    <a
                      href="mailto:hello@revenuad.com"
                      style={{
                        ...(p.featured ? primaryBtn : secondaryBtn),
                        width: "100%",
                        justifyContent: "center",
                        textDecoration: "none",
                      }}
                    >
                      {p.cta}
                    </a>
                  ) : (
                    <button
                      onClick={onEnter}
                      style={{
                        ...(p.featured ? primaryBtn : secondaryBtn),
                        width: "100%",
                        justifyContent: "center",
                      }}
                    >
                      {p.cta}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background: "#F7F6F3" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 32px", textAlign: "center" }}>
          <h2
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: "#1C1C1A",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Less prep.
            <br />
            Better pitches.
          </h2>
          <p
            style={{
              marginTop: 16,
              fontSize: 16,
              color: "#6B6B62",
              lineHeight: 1.6,
              maxWidth: 440,
              margin: "16px auto 0",
            }}
          >
            Join the independent agencies using R-AD to walk into every pitch knowing more than the room.
          </p>
          <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onEnter} style={primaryBtn}>
              Start free trial <ArrowRight size={14} />
            </button>
            <a href="#how" style={{ ...secondaryBtn, textDecoration: "none" }}>
              See how it works
            </a>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: "#C4C2BA" }}>
            No credit card required. Cancel any time. Setup takes 2 minutes.
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#FFFFFF", borderTop: "1px solid #EBE9E4" }}>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "24px 32px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 16,
            fontSize: 12,
          }}
        >
          <span style={{ color: "#C4C2BA", justifySelf: "start" }}>
            <span>revenuad</span>
            <span style={{ color: "#C9963A" }}>.</span>
            <span style={{ marginLeft: 4 }}>signal</span>
          </span>
          <span style={{ color: "#9E9D94", fontStyle: "italic" }}>Less prep. Better pitches.</span>
          <span style={{ color: "#C4C2BA", justifySelf: "end" }}>© 2026 · Privacy · Terms</span>
        </div>
      </footer>
    </div>
  );
}
