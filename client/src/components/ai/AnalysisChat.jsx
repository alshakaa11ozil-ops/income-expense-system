/*
 * ============================================================
 * FILE    : components/ai/AnalysisChat.jsx
 * LAYER   : View (component)
 * PURPOSE : Tab 3 of AiAssistantPage. Free-form financial Q&A
 *           powered by Gemini. Chat history is session-only —
 *           not persisted to the database between page visits.
 *           The teacher requirement does not include persistence,
 *           and the feature works well without it.
 * DEPENDS : ai_analyze_finances (api), utils/ai_error_helper
 * ============================================================
 * EXPORTS:
 *   - AnalysisChat : session chat component
 * ============================================================
 */

import React, { useState, useRef, useEffect } from 'react'
import { get_ai_error_message } from '../../utils/ai_error_helper'
import { ai_analyze_finances } from '../../services/api'
import { useToast } from '../layout/useToast'

// ── Suggestion chips shown before first message ───────────────
const SUGGESTION_CHIPS = [
    "What's my biggest expense category?",
    "Am I saving enough this month?",
    "Which month was my best financially?",
    "How do my expenses compare to last month?",
    "What should I cut back on?",
]

/*
 * COMPONENT : AnalysisChat
 * ─────────────────────────────────────────────────────────
 * WHY      : The first two AI tabs cover structured use cases
 *            (planning, purchase decisions). This tab handles
 *            everything else — open-ended questions the user
 *            would ask a financial advisor. The backend injects
 *            full financial context before forwarding to Gemini.
 *
 * HOW      : 1. Empty state: suggestion chips as conversation starters
 *            2. User types or clicks a chip → handle_send
 *            3. User message added to messages array immediately
 *            4. ai_analyze_finances call → assistant response added
 *            5. Auto-scroll keeps latest message in view
 *            6. key_insights rendered as bullet list below answer
 *            7. Input auto-focuses after each response
 *
 * @prop    {Function} on_request_complete() — parent refreshes usage counter
 * ─────────────────────────────────────────────────────────
 */
export default function AnalysisChat({ on_request_complete }) {
    const { show_toast } = useToast()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [is_loading, setIsLoading] = useState(false)

    const messages_end_ref = useRef(null)
    const input_ref = useRef(null)

    /*
     * WHY auto-scroll on every message change:
     *   New messages may be taller than the viewport.
     *   Without scroll the user has to manually scroll down
     *   to read each response — poor UX in a chat interface.
     */
    useEffect(() => {
        messages_end_ref.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    /*
     * WHY auto-focus input after loading ends:
     *   After Gemini responds the user's cursor is not in the
     *   input field. Without auto-focus they must click before
     *   typing a follow-up — extra friction in a chat session.
     */
    useEffect(() => {
        if (!is_loading) {
            input_ref.current?.focus()
        }
    }, [is_loading])

    /*
     * FUNCTION : handle_send
     * WHY      : Adds the user message immediately (optimistic),
     *            then awaits the AI response. On error the error
     *            message is added as an assistant bubble so the
     *            chat layout stays consistent — no separate error
     *            state to manage.
     * @param   {string} question_override — used by suggestion chips
     *                   to submit without relying on input state
     */
    const handle_send = async (question_override) => {
        const question = (question_override ?? input).trim()
        if (!question || is_loading) return

        // Clear input immediately so the field feels responsive
        setInput('')
        setIsLoading(true)

        const user_msg = {
            id: Date.now(),
            role: 'user',
            content: question,
        }
        setMessages(prev => [...prev, user_msg])

        try {
            const data = await ai_analyze_finances(question)
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.answer,
                key_insights: data.key_insights ?? [],
            }])
            show_toast('Analysis complete.', 'success')
            on_request_complete()
        } catch (err) {
            const error_message = get_ai_error_message(err)
            show_toast(error_message, 'error')
            // WHY also append as assistant message: keeps chat context
            // so the user sees which question failed.
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: error_message,
                is_error: true,
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const handle_key_down = (e) => {
        // Shift+Enter = newline; bare Enter = submit
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handle_send()
        }
    }

    return (
        <div className="flex flex-col h-full" style={{ minHeight: '520px' }}>

            {/* ── Header note ── */}
            <p className="text-xs text-slate-500 mb-3 text-center">
                Chat history is cleared when you leave this page. · Gemini has full access to your financial data.
            </p>

            {/* ── Message area ── */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4"
                style={{ maxHeight: '420px' }}>

                {/* ── Suggestion chips (empty state) ── */}
                {messages.length === 0 && !is_loading && (
                    <div className="pt-6">
                        <p className="text-center text-slate-500 text-sm mb-4">
                            Ask anything about your finances, or try one of these:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {SUGGESTION_CHIPS.map(chip => (
                                <button
                                    key={chip}
                                    onClick={() => handle_send(chip)}
                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-400
                                               text-slate-600 hover:text-slate-900 text-sm
                                               rounded-xl border border-slate-400
                                               hover:border-slate-600 transition-all"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Message bubbles ── */}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'user' ? (
                            /* User bubble */
                            <div className="max-w-[75%] bg-indigo-600 text-white
                                            rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                                {msg.content}
                            </div>
                        ) : (
                            /* Assistant bubble */
                            <div className={`
                                max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed
                                ${msg.is_error
                                    ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                                    : 'bg-slate-200 text-slate-700 shadow-sm'
                                }
                            `}>
                                {/*
                                  * WHY whitespace-pre-wrap:
                                  *   Gemini often formats answers with newlines and
                                  *   paragraph breaks. Without this they collapse into
                                  *   a single unreadable block of text.
                                  */}
                                <p className="whitespace-pre-wrap">{msg.content}</p>

                                {/* Key insights as bullets */}
                                {msg.key_insights?.length > 0 && (
                                    <ul className="mt-3 space-y-1.5 pt-3 border-t border-slate-400/60">
                                        {msg.key_insights.map((insight, i) => (
                                            <li key={i} className="flex gap-2 text-xs text-slate-500">
                                                <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                                                {insight}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* ── Loading indicator ── */}
                {is_loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <div className="flex gap-1 items-center h-4">
                                {[0, 1, 2].map(i => (
                                    <span
                                        key={i}
                                        className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                                        style={{ animationDelay: `${i * 150}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Scroll anchor */}
                <div ref={messages_end_ref} />
            </div>

            {/* ── Clear button ── */}
            {messages.length > 0 && (
                <div className="flex justify-center mb-2">
                    <button
                        onClick={() => setMessages([])}
                        className="text-xs text-slate-500 hover:text-slate-600
                                   transition-colors px-3 py-1"
                    >
                        Clear conversation
                    </button>
                </div>
            )}

            {/* ── Input bar ── */}
            <div className="flex gap-2 pt-3 border-t border-slate-400/60">
                <textarea
                    ref={input_ref}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handle_key_down}
                    placeholder="Ask about your finances…"
                    rows={1}
                    className="flex-1 bg-slate-200 border border-slate-400 text-slate-900
                               rounded-xl px-4 py-2.5 text-sm resize-none
                               focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                               placeholder:text-slate-600 leading-relaxed"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <button
                    onClick={() => handle_send()}
                    disabled={is_loading || !input.trim()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500
                               text-white text-sm font-medium rounded-xl
                               transition-colors disabled:opacity-40
                               disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Send message"
                >
                    Send →
                </button>
            </div>
        </div>
    )
}