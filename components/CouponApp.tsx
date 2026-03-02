
import React, { useState, useEffect } from 'react';
import { Home, Ticket, Plus, Trash2, Search, CheckCircle, User, LogIn } from 'lucide-react';
import * as couponService from '../services/couponService';
import * as studentService from '../services/studentService';
import { Coupon, Participant, ClassStudent } from '../types';

interface CouponAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

export const CouponApp: React.FC<CouponAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  
  // Issue Form
  const [studentName, setStudentName] = useState('');
  const [couponType, setCouponType] = useState('숙제 면제권');
  const [customType, setCustomType] = useState('');

  // Search (Teacher Only)
  const [search, setSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const fetched = await studentService.fetchRosterFromDb();
        if (fetched.length > 0) {
          studentService.saveRoster(fetched);
          setRoster(fetched);
        } else {
          setRoster(studentService.getRoster());
        }
      } catch {
        setRoster(studentService.getRoster());
      }
    };
    init();
    loadCoupons();
    const interval = setInterval(loadCoupons, 1000);
    return () => clearInterval(interval);
  }, [isTeacherMode]);

  const loadCoupons = () => {
    setCoupons(couponService.getCoupons());
  };

  const handleIssue = () => {
    if (!studentName.trim()) {
        alert('학생을 선택해주세요.');
        return;
    }
    const finalType = couponType === 'custom' ? customType : couponType;
    if (!finalType.trim()) {
        alert('쿠폰 종류를 입력해주세요.');
        return;
    }

    couponService.issueCoupon(studentName, finalType);
    setStudentName('');
    if(couponType === 'custom') setCustomType('');
    loadCoupons();
    alert('쿠폰이 발급되었습니다! 🎟️');
  };

  const handleUse = (id: string) => {
    if (!isTeacherMode) {
        alert('쿠폰 사용 처리는 선생님만 할 수 있어요.');
        return;
    }
    if(!confirm('쿠폰을 사용 처리하시겠습니까?')) return;
    
    // 1. Optimistic Update (Immediate Gray Out)
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, isUsed: true } : c));
    
    // 2. Commit to Storage
    couponService.useCoupon(id);
    
    // 3. Show Alert after UI paint
    setTimeout(() => {
        alert('사용 처리가 완료되었습니다.');
    }, 50);
  };

  const handleDelete = (id: string) => {
    if(!confirm('삭제하시겠습니까?')) return;
    couponService.deleteCoupon(id);
    loadCoupons();
  };

  // Filter Logic
  const filteredCoupons = coupons.filter(c => {
      if (isTeacherMode) {
          // Teacher sees all, filters by search
          return c.studentName.includes(search) || c.type.includes(search);
      } else {
          // Student sees ONLY their own coupons
          return student && c.studentName === student.nickname;
      }
  }).sort((a,b) => {
      // Sort: Unused first, then by date desc
      if (a.isUsed === b.isUsed) {
          return new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime();
      }
      return a.isUsed ? 1 : -1; 
  });

  const PRESETS = ['숙제 면제권', '급식 우선권', '자리 바꾸기권', '짝꿍 지정권', '사탕 교환권'];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
       <header className="bg-slate-800 p-4 shadow-md flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-3">
              <button onClick={onBack} className="bg-slate-700 p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-600"><Home size={20}/></button>
              <h1 className="font-bold text-yellow-500 text-xl flex items-center gap-2"><Ticket /> 학급 쿠폰함</h1>
          </div>
          {!isTeacherMode && student && (
              <div className="text-xs text-white bg-slate-700 px-3 py-1.5 rounded-full border border-slate-600 flex items-center gap-2">
                  <User size={14} />
                  {student.nickname}님의 쿠폰함
              </div>
          )}
       </header>

       <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full flex flex-col md:flex-row gap-6">
           {/* Left Sidebar: Issue (Teacher) or Info (Student) */}
           <div className="w-full md:w-80 space-y-6 shrink-0">
                {isTeacherMode ? (
                    <>
                        <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl p-6 shadow-lg text-white">
                            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Plus size={20} /> 쿠폰 발급하기
                            </h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-yellow-100 mb-1">학생 이름</label>
                                    <select 
                                        value={studentName}
                                        onChange={e => setStudentName(e.target.value)}
                                        className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white [&>option]:text-black"
                                    >
                                        <option value="">학생 선택...</option>
                                        {roster.map(s => (
                                            <option key={s.id} value={s.name}>
                                                {s.number}. {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-yellow-100 mb-1">쿠폰 종류</label>
                                    <select 
                                        value={couponType}
                                        onChange={e => setCouponType(e.target.value)}
                                        className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-white [&>option]:text-black"
                                    >
                                        {PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                                        <option value="custom">직접 입력...</option>
                                    </select>
                                    {couponType === 'custom' && (
                                        <input 
                                            type="text"
                                            value={customType}
                                            onChange={e => setCustomType(e.target.value)}
                                            className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder-white/50 mt-2 focus:outline-none"
                                            placeholder="쿠폰 이름 입력"
                                        />
                                    )}
                                </div>

                                <button 
                                    onClick={handleIssue}
                                    className="w-full bg-white text-amber-600 font-bold py-3 rounded-lg shadow hover:bg-yellow-50 active:scale-95 transition-all"
                                >
                                    발급하기
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-2xl p-4 shadow-md border border-slate-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input 
                                    type="text" 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="이름으로 검색..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 text-white focus:ring-1 focus:ring-yellow-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    // Student Info Panel
                    <div className="bg-slate-800 rounded-2xl p-6 text-slate-300 border border-slate-700">
                        <h3 className="text-white font-bold text-lg mb-2">🎁 쿠폰 사용 안내</h3>
                        <p className="text-sm mb-4">선생님이 발급해주신 쿠폰을 확인할 수 있습니다.</p>
                        <ul className="text-xs space-y-2 list-disc pl-4">
                            <li>쿠폰은 1회만 사용할 수 있습니다.</li>
                            <li>사용 처리는 선생님만 할 수 있습니다.</li>
                            <li>학생은 쿠폰 목록만 확인할 수 있습니다.</li>
                        </ul>
                    </div>
                )}
           </div>

           {/* Right: Coupon List */}
           <div className="flex-1 overflow-y-auto">
                {!isTeacherMode && !student ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed">
                        <Ticket size={48} className="mb-4 opacity-30" />
                        <p className="mb-4">로그인하면 내 쿠폰을 확인할 수 있습니다.</p>
                        <button onClick={onLoginRequest} className="bg-yellow-500 text-slate-900 px-6 py-2 rounded-lg font-bold hover:bg-yellow-400 flex items-center gap-2">
                            <LogIn size={18} /> 학생 로그인
                        </button>
                    </div>
                ) : filteredCoupons.length === 0 ? (
                   <div className="col-span-full text-center py-20 text-slate-600">
                       <Ticket size={48} className="mx-auto mb-4 opacity-20" />
                       <p>{isTeacherMode ? '발급된 쿠폰이 없습니다.' : '보유한 쿠폰이 없습니다 😢'}</p>
                   </div>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {filteredCoupons.map(coupon => (
                           <div 
                                key={coupon.id} 
                                className={`
                                    relative p-4 rounded-xl shadow-md border-l-8 flex flex-col justify-between min-h-[160px] transition-all duration-300
                                    ${coupon.isUsed 
                                        ? 'bg-gray-200 border-gray-400 opacity-80 grayscale' // Changed to Gray for used state
                                        : 'bg-white border-yellow-400 hover:scale-[1.02]'}
                                `}
                            >
                                {/* Pattern Overlay */}
                                {!coupon.isUsed && <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/diamond-upholstery.png')] pointer-events-none"></div>}

                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${coupon.isUsed ? 'bg-gray-600 text-gray-200' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {coupon.isUsed ? '사용 완료' : '사용 가능'}
                                        </span>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">{new Date(coupon.issuedDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    
                                    <h3 className={`font-black text-2xl mb-1 mt-2 ${coupon.isUsed ? 'text-gray-500 line-through decoration-2' : 'text-gray-800'}`}>
                                        {coupon.type}
                                    </h3>
                                    <p className="text-gray-600 font-medium flex items-center gap-1 text-sm">
                                        To. {coupon.studentName}
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2 mt-6 z-10">
                                    {isTeacherMode ? (
                                        <>
                                            {!coupon.isUsed ? (
                                                <button 
                                                    onClick={() => handleUse(coupon.id)}
                                                    className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-colors"
                                                >
                                                    사용 처리
                                                </button>
                                            ) : (
                                                <span className="text-gray-500 font-bold text-xs border border-gray-400 px-3 py-1.5 rounded-lg bg-gray-100 cursor-default">
                                                    처리 완료
                                                </span>
                                            )}
                                            <button onClick={() => handleDelete(coupon.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        coupon.isUsed ? (
                                            <div className="text-sm text-gray-500 font-bold flex items-center gap-1 bg-gray-300/50 px-3 py-1.5 rounded-lg">
                                                <CheckCircle size={14}/> 사용 완료됨
                                            </div>
                                        ) : (
                                            <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 border border-yellow-200">
                                                사용 가능
                                            </div>
                                        )
                                    )}
                                </div>
                           </div>
                       ))}
                   </div>
                )}
           </div>
       </main>
    </div>
  );
};
