/*
 * ============================================================
 * FILE    : ProfilePage.jsx
 * LAYER   : View (page)
 * PURPOSE : User account overview and password management.
 *           Shows account info, role, AI usage quota, and a
 *           form to change the user's own password.
 *           Renders inside Layout — sidebar already present.
 * DEPENDS : api (get_ai_usage, change_password), AuthContext, ToastContext
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth_context';
import { useToast } from '../components/layout/useToast';
import { get_ai_usage, change_password } from '../services/api';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

/*
 * FUNCTION : get_avatar_color
 * WHY      : Gives each user a consistent color without
 *            needing image uploads or a third-party service.
 *            Simple hash of username picks from 8 preset colors.
 */
const AVATAR_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
    '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
];

function get_avatar_color(username) {
    let hash = 0;
    const name = username || 'User';
    for (const ch of name) hash += ch.charCodeAt(0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const { current_user } = useAuth();
    const { show_toast } = useToast();
    
    // AI Usage State
    const [usage, setUsage] = useState(null);
    const [usage_loading, setUsageLoading] = useState(true);
    
    const [current_password, setCurrentPassword] = useState('');
    const [new_password, setNewPassword] = useState('');
    const [confirm_password, setConfirmPassword] = useState('');
    const [show_current, setShowCurrent] = useState(false);
    const [show_new, setShowNew] = useState(false);
    const [password_errors, setPasswordErrors] = useState({});
    const [is_changing, setIsChanging] = useState(false);
    const [password_strength, setPasswordStrength] = useState(0);

    // BROWSER TITLE
    useEffect(() => {
        document.title = 'My Profile | FinanceApp';
        return () => { document.title = 'FinanceApp'; };
    }, []);

    // FETCH USAGE (on mount)
    useEffect(() => {
        if (current_user) {
            get_ai_usage()
                .then(res => setUsage(res))
                .catch(err => {
                    console.error('Failed to load AI usage on profile page:', err);
                })
                .finally(() => setUsageLoading(false));
        }
    }, [current_user]);

    // PASSWORD STRENGTH
    useEffect(() => {
        let score = 0;
        if (new_password.length >= 8) score++;
        if (/\d/.test(new_password)) score++;
        if (/[!@#$%^&*()_+{}[\]:;<>,.?~\\/-]/.test(new_password)) score++;
        setPasswordStrength(score);
    }, [new_password]);

    // HANDLER: Change Password
    const handle_password_change = async (e) => {
        e.preventDefault();
        setPasswordErrors({});
        const errs = {};

        if (!current_password) {
            errs.current = 'Enter your current password';
        }
        if (new_password.length < 8) {
            errs.new = 'Password must be at least 8 characters';
        }
        if (new_password !== confirm_password) {
            errs.confirm = 'Passwords do not match';
        }
        
        if (Object.keys(errs).length > 0) {
            setPasswordErrors(errs);
            return;
        }

        setIsChanging(true);
        try {
            await change_password(current_password, new_password);
            show_toast('Password updated successfully.', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordStrength(0);
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error || '';
            
            if (status === 400 && msg.toLowerCase().includes('current')) {
                setPasswordErrors({ current: 'Current password is incorrect.' });
            } else if (status === 400) {
                setPasswordErrors({ new: msg || 'New password is invalid.' });
            } else {
                show_toast('Failed to change password. Please try again.', 'error');
            }
        } finally {
            setIsChanging(false);
        }
    };

    // Safe fallbacks for display


    const username = current_user?.username || 'User';
    const email = current_user?.email || '';
    const role = current_user?.role || 'USER';
    const initials = username.slice(0, 2).toUpperCase();
    const ai_limit = current_user?.ai_daily_limit || 0;

    let used_pct = 0;
    let barColor = 'bg-emerald-500';
    if (usage && usage.daily_limit > 0) {
        used_pct = ((usage.daily_limit - usage.remaining) / usage.daily_limit) * 100;
        if (used_pct < 50) barColor = 'bg-emerald-500';
        else if (used_pct <= 90) barColor = 'bg-amber-500';
        else barColor = 'bg-red-500';
    }

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">My Profile</h1>

            {/* HEADER CARD */}
            <div className="bg-white rounded-xl p-6 flex items-center gap-6 shadow-sm border border-slate-200">
                <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: get_avatar_color(username) }}
                >
                    <span className="text-white font-bold text-xl">{initials}</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">{username}</h2>
                    <p className="text-slate-500 text-sm mt-0.5">{email}</p>
                    <div className="mt-2 inline-block">
                        {role === 'ADMIN' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                ADMIN
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                USER
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* TWO-COLUMN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN: Account Details */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col h-full">
                    <h3 className="text-slate-900 font-semibold mb-4 text-lg">Account Details</h3>
                    <div className="flex-1 space-y-0 text-sm">
                        <div className="flex justify-between items-center border-b border-slate-100 py-3">
                            <span className="text-slate-500">Username</span>
                            <span className="text-slate-900 font-medium">{username}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 py-3">
                            <span className="text-slate-500">Email</span>
                            <span className="text-slate-900 font-medium">{email}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 py-3">
                            <span className="text-slate-500">Role</span>
                            <span>
                                {role === 'ADMIN' ? (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        ADMIN
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                        USER
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between items-center border-slate-100 py-3">
                            <span className="text-slate-500">Daily AI Limit</span>
                            <span className="text-slate-900 font-medium">{ai_limit} requests/day</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: AI Usage Today */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col h-full">
                    <h3 className="text-slate-900 font-semibold mb-4 text-lg">AI Usage Today</h3>
                    
                    {usage_loading ? (
                        <div className="flex-1 flex flex-col justify-center space-y-4 pr-10">
                            <div className="h-8 bg-slate-100 rounded w-1/3 animate-pulse"></div>
                            <div className="h-3 bg-slate-100 rounded w-full flex-1 animate-pulse mb-1 mt-4 max-h-[8px]"></div>
                        </div>
                    ) : usage ? (
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className={`text-4xl font-bold tracking-tight ${usage.remaining > 5 ? 'text-emerald-500' : usage.remaining > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                    {usage.remaining}
                                </span>
                                <span className="text-slate-500 text-sm font-medium">
                                    of {usage.daily_limit} requests remaining today
                                </span>
                            </div>
                            
                            <div className="w-full bg-slate-100 rounded-full h-2 mt-4 mb-1 overflow-hidden">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`} 
                                    style={{ width: `${Math.min(100, Math.max(0, used_pct))}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1 mb-auto">
                                <span>{usage.daily_limit - usage.remaining} used</span>
                                <span>{usage.daily_limit} total</span>
                            </div>

                            <p className="text-xs text-slate-600 mt-4 bg-amber-50 p-3 rounded-lg flex items-start sm:items-center gap-2 leading-relaxed">
                                <span className="text-amber-500 text-sm shrink-0">⚡</span> Cached responses are free and don't count toward your limit.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-center text-center py-4 text-slate-500 text-sm">
                            Could not load AI usage information.
                        </div>
                    )}
                </div>
            </div>

            {/* CHANGE PASSWORD CARD */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-slate-900 font-semibold mb-6 text-lg">Change Password</h3>
                
                <form onSubmit={handle_password_change} className="space-y-5 max-w-sm">
                    {/* Current Password Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Current Password
                        </label>
                        <div className="relative">
                            <input
                                type={show_current ? "text" : "password"}
                                value={current_password}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className={`w-full bg-slate-50 border ${password_errors.current ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'} rounded-lg px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                onClick={() => setShowCurrent(!show_current)}
                            >
                                {show_current ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        {password_errors.current && (
                            <p className="text-red-500 text-sm mt-1.5 font-medium">{password_errors.current}</p>
                        )}
                    </div>

                    {/* New Password Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                type={show_new ? "text" : "password"}
                                value={new_password}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={`w-full bg-slate-50 border ${password_errors.new ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'} rounded-lg px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                                placeholder="Min. 8 characters"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                onClick={() => setShowNew(!show_new)}
                            >
                                {show_new ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        
                        {/* Password Strength Indicator */}
                        <div className="mt-2 flex items-center justify-between">
                            <div className="flex w-full gap-1 h-1.5 mr-3">
                                <div className={`flex-1 rounded-full ${scoreToBgClass(password_strength, 1)} transition-all duration-300`} />
                                <div className={`flex-1 rounded-full ${scoreToBgClass(password_strength, 2)} transition-all duration-300`} />
                                <div className={`flex-1 rounded-full ${scoreToBgClass(password_strength, 3)} transition-all duration-300`} />
                            </div>
                            <span className={`text-xs select-none min-w-[36px] text-right font-medium ${scoreToTextClass(password_strength)}`}>
                                {scoreToLabel(password_strength)}
                            </span>
                        </div>

                        {password_errors.new && (
                            <p className="text-red-500 text-sm mt-1.5 font-medium">{password_errors.new}</p>
                        )}
                    </div>

                    {/* Confirm Password Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={confirm_password}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full bg-slate-50 border ${password_errors.confirm ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'} rounded-lg px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                            placeholder="Re-enter new password"
                        />
                        {password_errors.confirm && (
                            <p className="text-red-500 text-sm mt-1.5 font-medium">{password_errors.confirm}</p>
                        )}
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={is_changing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-2.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {is_changing ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Updating...
                                </>
                            ) : (
                                "Update Password"
                            )}
                        </button>
                    </div>
                </form>
            </div>


        </div>
    );
}

// Helpers for the password strength UI
function scoreToBgClass(score, target) {
    if (score < target) return 'bg-slate-200';
    if (score === 1) return 'bg-red-500';
    if (score === 2) return target <= 2 ? 'bg-amber-400' : 'bg-slate-200';
    return 'bg-emerald-500';
}

function scoreToTextClass(score) {
    if (score === 1) return 'text-red-500';
    if (score === 2) return 'text-amber-500';
    if (score === 3) return 'text-emerald-500';
    return 'text-transparent';
}

function scoreToLabel(score) {
    if (score === 0) return '';
    if (score === 1) return 'Weak';
    if (score === 2) return 'Fair';
    return 'Strong';
}
