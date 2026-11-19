"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/components/AuthContext";

interface Message {
  id?: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
  failed?: boolean;
}

type StreamEvent =
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: { saved: boolean; messageId: string | null } }
  | { event: "error"; data: { code: string; message: string } };

// Reads server-sent events from a fetch response, one complete frame at a time.
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (event && data) yield { event, data: JSON.parse(data) } as StreamEvent;
    }
  }
}

export default function Home() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { signedIn, userInfo } = useAuth();
  const first = messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load saved messages when the user signs in; clear them when they sign out.
  useEffect(() => {
    if (!signedIn) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const response = await fetch("/api/app-info");
        if (!response.ok) return;
        const data: { messages: Message[] } = await response.json();
        setMessages(data.messages ?? []);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    })();
  }, [signedIn]);

  // Applies a change to the reply that is currently streaming (always the last message).
  const updateReply = (change: (reply: Message) => Message) =>
    setMessages((prev) => [...prev.slice(0, -1), change(prev[prev.length - 1]!)]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = value.trim();
    if (!msg || loading) return;

    setLoading(true);
    setValue("");
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { role: "user", text: msg, createdAt: now },
      { role: "model", text: "", createdAt: now },
    ]);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const text = data?.error?.message ?? "Failed to get a response. Please try again.";
        updateReply((reply) => ({ ...reply, text, failed: true }));
        return;
      }

      for await (const ev of readEvents(res.body)) {
        if (ev.event === "delta") updateReply((reply) => ({ ...reply, text: reply.text + ev.data.text }));
        else if (ev.event === "error") updateReply((reply) => ({ ...reply, text: `${reply.text}\n\n${ev.data.message}`.trim(), failed: true }));
        else if (ev.event === "done" && ev.data.messageId) updateReply((reply) => ({ ...reply, id: ev.data.messageId! }));
      }
    } catch (err) {
      console.error("Request failed:", err);
      updateReply((reply) => ({ ...reply, text: "Failed to get a response. Please try again.", failed: true }));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center ">
      {/* Header */}
      <div className={`shrink-0 p-4 text-center ${first ? "" : "hidden"}`}>
        <h2 className={`text-4xl font-nunito ${signedIn ? "pb-4" : ""}`}>
          {!signedIn ? "Get started on the go with AI" : `Welcome back ${userInfo?.name}!`}
        </h2>
        {!signedIn && (
          <h3 className="text-xl pb-4">
            Login to <u className="underline">Explore</u> more features and save your chats!
          </h3>
        )}
      </div>

      {/* Messages Container */}
      <div className={`flex-1 w-full overflow-y-auto px-4 pt-24 pb-4 ${first ? "hidden" : ""}`}>
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => {
            const mine = message.role === "user";
            const streaming = loading && index === messages.length - 1;
            return (
              <div key={message.id ?? index} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-lg px-4 py-2 max-w-lg lg:max-w-xl wrap-break-word ${
                    mine ? "bg-blue-500 text-white" : message.failed ? "bg-red-100 text-red-900" : "bg-gray-200 text-black"
                  }`}
                >
                  {streaming && !message.text ? (
                    <div className="flex space-x-1 py-2">
                      <div className="w-1 h-1 bg-black rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-black rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-1 h-1 bg-black rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  ) : (
                    <p className="wrap-break-word whitespace-pre-wrap overflow-wrap-anywhere">{message.text}</p>
                  )}
                  <span className="text-xs opacity-75">{new Date(message.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Container */}
      <div className="shrink-0 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative ">
            <span className="p-[0.2rem] relative rounded-[1.75rem] bg-linear-to-r from-[#ff1b6b] to-[#45caff] animate-gradient bg-white block">
              <span className="p-[0.2rem] mb-2 relative rounded-[1.75rem] bg-white block">
                <textarea
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  maxLength={4000}
                  className="w-full disabled:bg-white text-black resize-none rounded-3xl p-3 pr-16 border-none outline-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:cursor-pointer"
                  placeholder="Type your message..."
                  rows={2}
                  cols={50}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !value.trim()}
                  className="absolute top-[0.2rem] right-4 h-12 w-12 rounded-xl bg-white shadow-[-4px_0_3px_#fff] flex items-center justify-center disabled:opacity-50"
                >
                  <Image
                    className={`${value.length >= 1 && !loading ? "invert-[.7] hover:cursor-pointer" : "invert-[.4]"}`}
                    src="/send.svg"
                    width={35}
                    height={35}
                    alt="Send"
                  />
                </button>
              </span>
            </span>
          </form>
        </div>
      </div>

      {/* Sign in/up buttons for non-authenticated users */}
      {!signedIn && (
        <div className="shrink-0 flex justify-center gap-4 p-4">
          <button
            className="bg-transparent cursor-pointer hover:bg-white/30 text-white border border-white px-6 py-2 rounded-lg"
            onClick={() => router.push("/login")}
          >
            Sign in
          </button>
          <button
            className="bg-transparent cursor-pointer hover:bg-white/30 text-white border border-white px-6 py-2 rounded-lg"
            onClick={() => router.push("/signup")}
          >
            Sign up
          </button>
        </div>
      )}
    </div>
  );
}
