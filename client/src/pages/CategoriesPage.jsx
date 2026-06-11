import React, { useState, useEffect } from 'react';
import { 
    get_categories, 
    get_my_categories, 
    create_my_category, 
    update_my_category, 
    delete_my_category,
    get_budget_goals,
    save_budget_goal,
    delete_budget_goal,
    get_analytics_category_activity,
    get_analytics_summary,
    get_analytics_trends
} from '../services/api';
import { useToast } from '../components/layout/useToast';
import { parse_currency } from '../utils/format_currency';

export default function CategoriesPage() {
    const { show_toast } = useToast();
    
    // Core state
    const [systemCategories, setSystemCategories] = useState([]);
    const [myCategories, setMyCategories] = useState([]);
    const [spendingMap, setSpendingMap] = useState({}); // { category_id: { total, percentage } }
    const [goalsMap, setGoalsMap] = useState({});       // { category_id: BudgetGoal row }
    
    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null); // For slide-out
    const [selectedCategoryStats, setSelectedCategoryStats] = useState({ income: '0.00', expense: '0.00', history: [] });
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // Current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    useEffect(() => {
        if (!selectedCategory) return;
        
        let isMounted = true;
        setIsLoadingStats(true);
        
        Promise.all([
            get_analytics_summary(currentMonth, currentYear, selectedCategory.id),
            get_analytics_trends(6, selectedCategory.id)
        ]).then(([summary, trends]) => {
            if (!isMounted) return;
            setSelectedCategoryStats({
                income: summary.total_income,
                expense: summary.total_expense,
                history: trends
            });
        }).catch(err => {
            console.error('Failed to load category stats', err);
        }).finally(() => {
            if (isMounted) setIsLoadingStats(false);
        });

        return () => { isMounted = false; };
    }, [selectedCategory, currentMonth, currentYear]);
    
    // Form state (Modal)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', icon: '📁', color: '#6B7280', limit: '' });
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [allCats, myCats, goals, analytics] = await Promise.all([
                get_categories(),
                get_my_categories().catch(() => null), // If 404/fails, return null
                get_budget_goals(currentMonth, currentYear).catch(() => []),
                get_analytics_category_activity(currentMonth, currentYear).catch(() => [])
            ]);

            // Filter system categories from the dropdown unified list
            const sys = allCats.filter(c => c.user_id === null);
            setSystemCategories(sys);
            
            // WHY: get_my_categories() returns only personal categories.
            // If the endpoint fails (404 on older deploys), fall back to
            // filtering the unified list from get_categories().
            setMyCategories(myCats !== null ? myCats : allCats.filter(c => c.user_id !== null));

            // Map goals
            const gMap = {};
            goals.forEach(g => { gMap[g.category_id] = g; });
            setGoalsMap(gMap);

            // Map analytics
            const sMap = {};
            analytics.forEach(a => { sMap[a.category_id] = a; });
            setSpendingMap(sMap);

        } catch (err) {
            console.error(err);
            show_toast("Failed to load categories data", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line
    }, []);

    const openAddForm = () => {
        setFormData({ id: null, name: '', icon: '📁', color: '#6B7280', limit: '' });
        setFormError('');
        setIsFormOpen(true);
        setSelectedCategory(null); // Close slide-out if open
    };

    const openEditForm = (cat) => {
        const goal = goalsMap[cat.id];
        setFormData({
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            limit: goal ? Number(goal.amount) : ''
        });
        setFormError('');
        setIsFormOpen(true);
        setSelectedCategory(null);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setIsSaving(true);

        try {
            let savedCat;
            const catPayload = { name: formData.name, icon: formData.icon, color: formData.color };
            
            if (formData.id) {
                savedCat = await update_my_category(formData.id, catPayload);
                show_toast('Category updated', 'success');
            } else {
                savedCat = await create_my_category(catPayload);
                show_toast('Category created', 'success');
            }

            // Handle Budget Goal / Soft Limit
            const goalId = goalsMap[savedCat.id]?.id;
            // Sanitize currency input
            const sanitizedAmount = parse_currency(formData.limit);
            const newLimit = parseFloat(sanitizedAmount);

            if (!isNaN(newLimit) && newLimit > 0) {
                // Save/Upsert
                await save_budget_goal(savedCat.id, newLimit, currentMonth, currentYear);
            } else if (goalId) {
                // Clear limit
                await delete_budget_goal(goalId, currentMonth, currentYear);
            }

            setIsFormOpen(false);
            await loadData(); // Reload everything to refresh UI
        } catch (err) {
            const status = err.response?.status;
            if (status === 409) {
                const msg = 'A category with this name already exists.';
                setFormError(msg);
                show_toast(msg, 'error');
            } else {
                const msg = err.response?.data?.error || err.response?.data?.message || 'Action failed.';
                setFormError(msg);
                show_toast(msg, 'error');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const [delete_confirm_id, setDeleteConfirmId] = useState(null);

    const handleDelete = async (catId) => {
        try {
            await delete_my_category(catId);
            show_toast("Category deleted", 'success');
            setSelectedCategory(null);
            setDeleteConfirmId(null);
            await loadData();
        } catch (err) {
            if (err.response?.status === 409) {
                show_toast("This category is used by existing records and can't be deleted.", 'error');
            } else {
                show_toast("Failed to delete category", 'error');
            }
            setDeleteConfirmId(null);
        }
    };

    // Calculate progress for cards
    const getProgressInfo = (catId) => {
        const limit = goalsMap[catId] ? parseFloat(goalsMap[catId].amount) : null;
        const spent = spendingMap[catId] ? parseFloat(spendingMap[catId].total_expense) : 0;
        
        if (limit === null) return null;
        
        const pct = Math.min((spent / limit) * 100, 100);
        let colorClass = 'bg-emerald-500';
        if (pct >= 100) colorClass = 'bg-red-500';
        else if (pct > 75) colorClass = 'bg-amber-400';

        return { limit, spent, pct, colorClass };
    };

    const renderCard = (cat, isSystem = false) => {
        const progress = getProgressInfo(cat.id);
        const activity = spendingMap[cat.id];
        
        const sum_expense = activity ? parseFloat(activity.total_expense) : 0;
        const sum_income = activity ? parseFloat(activity.total_income) : 0;
        const is_active = sum_expense > 0 || sum_income > 0;

        return (
            <div 
                key={cat.id}
                onClick={() => setSelectedCategory({ ...cat, isSystem })}
                className="bg-slate-200 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all flex flex-col group relative"
            >
                {/* Left accent color */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: cat.color }}></div>
                
                <div className="p-4 pl-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm bg-slate-300/50">
                            {cat.icon}
                        </div>
                        {isSystem && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-300/50 px-2 py-0.5 rounded-full">
                                System
                            </span>
                        )}
                        {!isSystem && is_active && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-300/30 px-2 py-1 rounded-md">
                                In Use
                            </span>
                        )}
                    </div>
                    
                    <h3 className="text-slate-900 font-semibold flex-1">{cat.name}</h3>
                    
                    {/* Micro budget visualizer */}
                    {progress ? (
                        <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">${progress.spent.toFixed(0)}</span>
                                <span className="text-slate-500">of ${progress.limit.toFixed(0)} limit</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-300 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${progress.colorClass}`}
                                    style={{ width: `${progress.pct}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 flex flex-col text-xs space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-[11px] uppercase tracking-wider">Activity this month</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {sum_income > 0 && (
                                    <span className="font-medium text-emerald-500">
                                        +${sum_income.toFixed(2)}
                                    </span>
                                )}
                                {sum_expense > 0 && (
                                    <span className="font-medium text-rose-500">
                                        -${sum_expense.toFixed(2)}
                                    </span>
                                )}
                                {!is_active && (
                                    <span className="text-slate-600">
                                        No activity
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 pb-24 h-full relative">
            <div className="max-w-6xl mx-auto">
                
                {/* Sticky Header */}
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50/80 backdrop-blur-md z-10 py-4 -mt-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage tags and monthly spending limits</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 text-slate-500 animate-pulse">Loading categories...</div>
                ) : (
                    <div className="space-y-12">
                        {/* My Categories */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-900">My Categories</h2>
                                <span className="text-sm font-medium text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                                    {myCategories.length} custom
                                </span>
                            </div>
                            {myCategories.length === 0 ? (
                                <div className="text-center py-12 bg-slate-200/30 rounded-2xl border border-dashed border-slate-400">
                                    <div className="text-4xl mb-3">🎨</div>
                                    <h3 className="text-slate-900 font-medium">No custom categories yet</h3>
                                    <p className="text-slate-500 text-sm mt-1 mb-4 max-w-sm mx-auto">
                                        Create your own categories to personalize how you track spending and income.
                                    </p>
                                    <button 
                                        onClick={openAddForm}
                                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Create Category
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {myCategories.map(cat => renderCard(cat, false))}
                                </div>
                            )}
                        </section>

                        <hr className="border-slate-300" />

                        {/* System Categories */}
                        <section>
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold text-slate-600">Default Categories</h2>
                                <p className="text-sm text-slate-500 mt-1">Universal tags available to all users</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 opacity-80 mix-blend-luminosity hover:mix-blend-normal hover:opacity-100 transition-all duration-500">
                                {systemCategories.map(cat => renderCard(cat, true))}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {/* Floating Action Button */}
            <button
                onClick={openAddForm}
                className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-500 text-white rounded-full 
                           shadow-lg shadow-emerald-500/30 flex items-center justify-center 
                           hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all z-20 group"
                title="Create new category"
            >
                <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>

            {/* ── Slide-Out Detail Panel ── */}
            {selectedCategory && (
                <>
                    <div 
                        className="fixed inset-0 bg-slate-100/40 backdrop-blur-sm z-40" 
                        onClick={() => setSelectedCategory(null)}
                    ></div>
                    <div className="fixed right-0 top-0 bottom-0 w-96 bg-slate-50 border-l border-slate-300 p-6 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                        
                        <div className="flex justify-between items-start mb-8">
                            <button onClick={() => setSelectedCategory(null)} className="text-slate-500 hover:text-slate-900 p-2 -ml-2 rounded-lg hover:bg-slate-300">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                                {selectedCategory.isSystem && (
                                <span className="bg-slate-200 text-slate-500 text-xs px-2.5 py-1 rounded-full font-medium">System Category</span>
                            )}
                        </div>

                        <div className="text-center mb-8">
                            <div 
                                className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-4xl shadow-lg mb-4"
                                style={{ backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color, border: `1px solid ${selectedCategory.color}40` }}
                            >
                                {selectedCategory.icon}
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">{selectedCategory.name}</h2>
                        </div>

                        {/* Detailed Category Stats */}
                        <div className="bg-slate-200 rounded-xl p-5 mb-6 shadow-inner">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex justify-between">
                                <span>This Month's Activity</span>
                                {isLoadingStats && <span className="animate-pulse">Loading...</span>}
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Income</p>
                                    <div className="text-2xl font-light text-emerald-400">
                                        ${isLoadingStats ? '---' : selectedCategoryStats.income}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Expense</p>
                                    <div className="text-2xl font-light text-rose-400">
                                        ${isLoadingStats ? '---' : selectedCategoryStats.expense}
                                    </div>
                                </div>
                            </div>

                            {/* 6-Month History Sparkline */}
                            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">6-Month History</h4>
                            <div className="flex items-end justify-between h-20 gap-1.5 mt-2">
                                {isLoadingStats ? (
                                    <div className="w-full h-full bg-slate-300/30 animate-pulse rounded"></div>
                                ) : (
                                    selectedCategoryStats.history.map((h, i) => {
                                        const inc = parseFloat(h.income);
                                        const exp = parseFloat(h.expense);
                                        // Dynamic scaling logic based on max value in history
                                        const maxVal = Math.max(
                                            ...selectedCategoryStats.history.flatMap(x => [parseFloat(x.income), parseFloat(x.expense)]),
                                            1 // Prevent divide by zero
                                        );
                                        
                                        const incHeight = Math.max((inc / maxVal) * 100, inc > 0 ? 4 : 0);
                                        const expHeight = Math.max((exp / maxVal) * 100, exp > 0 ? 4 : 0);
                                        
                                        return (
                                            <div key={i} className="flex flex-col items-center flex-1 group h-full">
                                                {/* Tooltip trigger area */}
                                                <div className="relative w-full h-full flex items-end justify-center gap-[1px]">
                                                    {/* Floating Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-100 border border-slate-400 text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-10 flex flex-col items-center">
                                                        <span className="text-slate-600 font-medium mb-0.5">{h.label}</span>
                                                        <span className="text-emerald-400">Inc: ${h.income}</span>
                                                        <span className="text-rose-400">Exp: ${h.expense}</span>
                                                    </div>
                                                    
                                                    {/* Bars */}
                                                    <div className="w-full max-w-[12px] bg-emerald-500/80 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-400" style={{ height: `${incHeight}%` }}></div>
                                                    <div className="w-full max-w-[12px] bg-rose-500/80 rounded-t-sm transition-all duration-300 group-hover:bg-rose-400" style={{ height: `${expHeight}%` }}></div>
                                                </div>
                                                <span className="text-[9px] text-slate-500 mt-1.5">{h.label.split(' ')[0]}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Budget Limit Visualizer (Large) */}
                        {!selectedCategory.isSystem && (() => {
                            const slide_out_progress = getProgressInfo(selectedCategory.id);
                            return (
                            <div className="bg-slate-200/50 rounded-xl p-5 mb-auto border border-slate-400/50">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Monthly Soft Limit</h4>
                                
                                {slide_out_progress ? (
                                    <>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-900 font-medium">${slide_out_progress.spent.toFixed(0)} spent</span>
                                            <span className="text-slate-500">${slide_out_progress.limit.toFixed(0)} limit</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${slide_out_progress.colorClass}`}
                                                style={{ width: `${slide_out_progress.pct}%` }}
                                            ></div>
                                        </div>
                                        <button 
                                            onClick={() => openEditForm(selectedCategory)}
                                            className="text-xs text-indigo-400 font-medium hover:text-indigo-300 mt-3 inline-block"
                                        >
                                            Change Limit
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-sm text-slate-500 mb-3">No limit set for this category.</p>
                                        <button 
                                            onClick={() => openEditForm(selectedCategory)}
                                            className="text-sm text-indigo-400 font-medium hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg"
                                        >
                                            Set Limit
                                        </button>
                                    </div>
                                )}
                            </div>
                        )})()}

                        {/* Action Buttons */}
                        {!selectedCategory.isSystem && (
                            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-300">
                                <button
                                    onClick={() => openEditForm(selectedCategory)}
                                    className="flex-1 bg-slate-200 hover:bg-slate-400 text-slate-900 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Edit Details
                                </button>

                                {delete_confirm_id === selectedCategory.id ? (
                                    <div className="flex gap-2 flex-1">
                                        <button
                                            onClick={() => handleDelete(selectedCategory.id)}
                                            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmId(null)}
                                            className="flex-1 bg-slate-300 hover:bg-slate-600 text-slate-600 py-2.5 rounded-lg text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirmId(selectedCategory.id)}
                                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        )}
                        {selectedCategory.isSystem && (
                            <p className="text-center text-sm text-slate-500 mt-auto pb-4">
                                System categories cannot be edited or deleted.
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* ── Category Form Modal ── */}
            {isFormOpen && (
                <>
                    <div className="fixed inset-0 bg-slate-100/60 backdrop-blur-sm z-[60]" onClick={() => !isSaving && setIsFormOpen(false)}></div>
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-50 border border-slate-400 shadow-2xl rounded-2xl p-6 z-[70] animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">
                            {formData.id ? 'Edit Category' : 'Create Category'}
                        </h2>
                        
                        {formError && (
                            <div className="mb-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-sm text-red-400">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
                                <input 
                                    type="text" 
                                    required minLength={2} maxLength={30}
                                    value={formData.name} 
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. Travel, Coffee, Software"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Icon (Emoji)</label>
                                    <input 
                                        type="text" 
                                        required maxLength={4}
                                        value={formData.icon} 
                                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 text-center text-xl focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Single emoji</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Badge Color</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="color" 
                                            value={formData.color} 
                                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                                            className="w-12 h-11 bg-transparent cursor-pointer rounded overflow-hidden p-0 border-0"
                                        />
                                        <span className="text-slate-500 font-mono text-sm uppercase">{formData.color}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-300/80">
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Soft Monthly Limit <span className="text-slate-500 font-normal">(Optional)</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                    <input 
                                        type="number" 
                                        min="0" step="1"
                                        value={formData.limit} 
                                        onChange={e => setFormData({ ...formData, limit: e.target.value })}
                                        className="w-full bg-slate-100 border border-slate-300 rounded-lg pl-8 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                        placeholder="No limit"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    A progress bar will show on the category card to help you stay within this limit each month.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-300 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}
