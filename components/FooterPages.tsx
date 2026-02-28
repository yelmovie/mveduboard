
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, HelpCircle, FileText, Users, Newspaper, Download, Zap, Shield, Smile, Heart, MessageSquare, PenTool, Plus, X, Upload, ExternalLink, Loader2 } from 'lucide-react';
import * as resourceService from '../services/resourceService';
import { CommunityPost, MaterialItem } from '../services/resourceService';
import { generateJson } from '../services/openaiClient';

interface FooterPageProps {
  pageId: string;
  onBack: () => void;
}

const NEWS_IMAGES = [
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=300&q=80'
];

const INITIAL_NEWS = [
    { 
        title: 'AI 디지털 교과서, 교실 혁명 이끈다', 
        date: '2024.03.15', 
        img: NEWS_IMAGES[0], 
        desc: '교육부가 추진하는 AI 디지털 교과서 도입이 본격화되면서 학교 현장의 변화가 예고된다.',
        url: 'https://www.google.com/search?q=AI+%EB%94%94%EC%A7%80%ED%84%B8+%EA%B5%90%EA%B3%BC%EC%84%9C+%EB%89%B4%EC%8A%A4' 
    },
    { 
        title: '에듀테크 박람회 성황리 개최... 최신 트렌드는?', 
        date: '2024.03.10', 
        img: NEWS_IMAGES[1], 
        desc: '올해 에듀테크 코리아 페어에서는 맞춤형 학습 솔루션과 메타버스 교육 플랫폼이 주목받았다.',
        url: 'https://www.etnews.com/news/section.html?id1=04'
    },
    { 
        title: '초등 코딩 교육 의무화 확대, 준비 상황 점검', 
        date: '2024.03.05', 
        img: NEWS_IMAGES[2], 
        desc: '디지털 인재 양성을 위한 코딩 교육 시수 확대 방안에 대해 현장 교사들의 의견을 들어보았다.',
        url: 'https://www.moe.go.kr/boardCnts/list.do?boardID=294&m=02'
    }
];

export const FooterPage: React.FC<FooterPageProps> = ({ pageId, onBack }) => {
  // --- Community State ---
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', tag: '잡담', author: '' });

  // --- Material State ---
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- News State ---
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // --- Common Init ---
  useEffect(() => {
      if (pageId === 'community') {
          setPosts(resourceService.getPosts());
      } else if (pageId === 'materials') {
          setMaterials(resourceService.getMaterials());
      } else if (pageId === 'news') {
          fetchNews();
      }
  }, [pageId]);

  const fetchNews = async () => {
      // Use cached news if available (simple optimization for this session)
      if (newsItems.length > 0) return;

      if (!import.meta.env.VITE_OPENAI_API_KEY && !import.meta.env.OPENAI_API_KEY) {
          setNewsItems(INITIAL_NEWS);
          return;
      }
      
      setLoadingNews(true);
      try {
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
          const prompt = `
            You cannot browse the web. Create 3 concise, plausible news-style items about:
            'South Korea Edutech', 'AI Digital Textbook', or 'Future Education'.
            Return a JSON object: { "news": [ ... ] } only.
            Each item must have:
            - title: Korean headline
            - date: "${today}"
            - desc: 1-2 sentences in Korean
            - url: a Google search URL with relevant query
            - source: a short Korean source name (e.g. "교육부", "에듀테크")
          `;

          const data = await generateJson<{ news?: Array<{ title: string; date: string; desc: string; url: string; source?: string }> }>(
            prompt,
            { maxTokens: 700 },
            '출력은 JSON만 반환하세요.'
          );

          if (data?.news && Array.isArray(data.news)) {
              const items = data.news.map((item: any, index: number) => ({
                  ...item,
                  img: NEWS_IMAGES[index % NEWS_IMAGES.length]
              }));
              setNewsItems(items);
          } else {
              setNewsItems(INITIAL_NEWS);
          }
      } catch (e) {
          console.error("Failed to fetch news", e);
          setNewsItems(INITIAL_NEWS); // Fallback
      } finally {
          setLoadingNews(false);
      }
  };

  // --- Community Handlers ---
  const handleWritePost = () => {
      if (!newPost.title || !newPost.content || !newPost.author) {
          alert('제목, 내용, 작성자명을 모두 입력해주세요.');
          return;
      }
      resourceService.addPost(newPost.title, newPost.content, newPost.tag, newPost.author);
      setPosts(resourceService.getPosts());
      setShowWriteModal(false);
      setNewPost({ title: '', content: '', tag: '잡담', author: '' });
  };

  const handleLikePost = (id: string) => {
      resourceService.toggleLike(id);
      setPosts(resourceService.getPosts());
  };

  // --- Material Handlers ---
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          resourceService.uploadMaterial(file);
          setMaterials(resourceService.getMaterials());
          alert('자료가 업로드되었습니다!');
      }
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = (id: string, title: string) => {
      resourceService.increaseDownloadCount(id);
      setMaterials(resourceService.getMaterials());
      
      // Simulate download
      const element = document.createElement("a");
      const file = new Blob([`[EduClass Sample File]\nTitle: ${title}\nThis is a placeholder file content for demonstration.`], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `${title}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  const renderContent = () => {
    switch (pageId) {
      case 'features':
        return (
          <div className="space-y-12">
            <div className="text-center">
              <span className="text-indigo-500 font-bold tracking-widest text-sm uppercase">Features</span>
              <h2 className="text-4xl font-black text-gray-900 mt-2 mb-4">EduClass의 강력한 기능</h2>
              <p className="text-xl text-gray-600">선생님의 업무는 줄이고, 아이들의 참여는 높입니다.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: '학급 경영 올인원', desc: '1인 1역, 자리배치, 포인트 관리까지 한 곳에서 해결하세요.' },
                { title: '실시간 소통', desc: '안전한 학급 SNS와 비밀 상담 쪽지로 마음을 나눕니다.' },
                { title: '수업 도구 모음', desc: '타이머, 판서, 발표 뽑기 등 수업에 필요한 모든 도구가 준비되어 있습니다.' }
              ].map((item, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-indigo-50">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'use_cases':
        return (
          <div className="space-y-10">
            <div className="text-center mb-12">
              <span className="text-green-600 font-bold tracking-widest text-sm uppercase">Success Stories</span>
              <h2 className="text-4xl font-black text-gray-900 mt-2">선생님들의 활용 사례</h2>
            </div>
            {[
              { name: '김OO 선생님 (3학년)', title: '아침 조회가 5분 만에 끝나요!', desc: '알림장과 1인 1역 기능을 활용하니 아이들이 스스로 할 일을 찾아서 합니다. 아침 시간이 정말 여유로워졌어요.' },
              { name: '이OO 선생님 (6학년)', title: '수학 시간이 기다려진대요', desc: '모둠 활동 때 타이머와 점수 기능을 썼더니 집중력이 달라졌습니다. 아이들이 서로 협동하는 모습이 보기 좋아요.' },
              { name: '박OO 선생님 (1학년)', title: '학부모님 만족도 최고', desc: '주간학습안내와 식단표를 보기 쉽게 공유해드리니 알림장 분실 걱정이 없다고 좋아하십니다.' }
            ].map((story, i) => (
              <div key={i} className="flex flex-col md:flex-row gap-6 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-3xl">👩‍🏫</div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">"{story.title}"</h3>
                  <p className="text-gray-600 mb-4">{story.desc}</p>
                  <span className="text-sm font-bold text-indigo-600">- {story.name}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'pricing':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-blue-500 font-bold tracking-widest text-sm uppercase">Pricing</span>
              <h2 className="text-4xl font-black text-gray-900 mt-2">단순하고 투명한 요금제</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-gray-100">
                <h3 className="text-2xl font-bold text-gray-800">Basic (무료)</h3>
                <div className="text-4xl font-black text-gray-900 my-4">₩0 <span className="text-base font-normal text-gray-500">/ 월</span></div>
                <p className="text-gray-500 mb-8">모든 필수 기능을 평생 무료로 사용하세요.</p>
                <ul className="space-y-4 mb-8">
                  {['학급 게시판 운영', '기본 수업 도구 (타이머, 판서)', '학생 명렬표 관리 (최대 30명)', '알림장 및 급식 확인'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-gray-700"><CheckCircle2 size={20} className="text-green-500"/> {f}</li>
                  ))}
                </ul>
                <button className="w-full py-4 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200">현재 사용 중</button>
              </div>
              <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden transform scale-105">
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
                <h3 className="text-2xl font-bold">Pro (교사)</h3>
                <div className="text-4xl font-black my-4">₩4,900 <span className="text-base font-normal opacity-70">/ 월</span></div>
                <p className="opacity-80 mb-8">더 많은 저장 용량과 AI 기능을 활용하세요.</p>
                <ul className="space-y-4 mb-8">
                  {['모든 Basic 기능 포함', 'AI 문제 생성 및 자료 추천', '무제한 파일 저장 용량', '학급 통계 리포트', '우선 고객 지원'].map(f => (
                    <li key={f} className="flex items-center gap-3"><CheckCircle2 size={20} className="text-yellow-400"/> {f}</li>
                  ))}
                </ul>
                <button className="w-full py-4 bg-white text-indigo-600 rounded-xl font-bold hover:bg-gray-50">30일 무료 체험하기</button>
              </div>
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-3">
                <HelpCircle className="text-indigo-500" size={32}/> 자주 묻는 질문
              </h2>
            </div>
            {[
              { q: '학생들도 회원가입이 필요한가요?', a: '아니요, 선생님이 공유해주신 "초대 코드"만 있으면 별도의 가입 없이 닉네임만 설정하여 바로 참여할 수 있습니다.' },
              { q: '데이터는 안전하게 보관되나요?', a: '네, 모든 데이터는 암호화되어 저장되며 선생님 본인 외에는 접근할 수 없습니다. 주기적인 백업을 통해 안전하게 관리됩니다.' },
              { q: '스마트폰에서도 사용할 수 있나요?', a: '물론입니다. PC, 태블릿, 스마트폰 등 모든 기기에서 최적화된 화면으로 이용하실 수 있습니다.' },
              { q: '무료 버전은 기간 제한이 있나요?', a: '아니요, Basic 요금제는 기간 제한 없이 평생 무료로 제공됩니다.' }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-start gap-2">
                  <span className="text-indigo-500">Q.</span> {item.q}
                </h3>
                <p className="text-gray-600 pl-6 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        );

      case 'terms':
        return (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><FileText /> 이용 약관</h2>
            <div className="space-y-6 text-gray-600 text-sm leading-relaxed h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">제1조 (목적)</h4>
                  <p>본 약관은 EduClass(이하 "회사")가 제공하는 교육용 플랫폼 서비스(이하 "서비스")의 이용조건 및 절차, 회사와 회원의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
              </div>
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">제2조 (용어의 정의)</h4>
                  <ul className="list-disc list-inside space-y-1">
                      <li>"서비스"라 함은 구현되는 단말기(PC, TV, 휴대형단말기 등 각종 유무선 장치를 포함)와 상관없이 회원이 이용할 수 있는 EduClass 관련 제반 서비스를 의미합니다.</li>
                      <li>"회원"이라 함은 회사의 서비스에 접속하여 이 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.</li>
                      <li>"콘텐츠"라 함은 서비스 상에 게시된 부호·문자·음성·음향·화상·동영상 등의 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 의미합니다.</li>
                  </ul>
              </div>
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">제3조 (약관의 명시와 개정)</h4>
                  <p>회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다. 회사는 "약관의 규제에 관한 법률", "정보통신망 이용촉진 및 정보보호 등에 관한 법률" 등 관련법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</p>
              </div>
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">제4조 (서비스의 제공 및 변경)</h4>
                  <p>회사는 회원에게 학급 경영 도구, 게시판, 커뮤니티 등의 서비스를 제공합니다. 회사는 운영상, 기술상의 필요에 따라 제공하고 있는 전부 또는 일부 서비스를 변경할 수 있습니다.</p>
              </div>
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">제5조 (개인정보보호 의무)</h4>
                  <p>회사는 "정보통신망법" 등 관계 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.</p>
              </div>
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">제6조 (회원의 의무)</h4>
                  <p>회원은 다음 행위를 하여서는 안 됩니다:</p>
                  <ul className="list-disc list-inside space-y-1">
                      <li>신청 또는 변경 시 허위내용의 등록</li>
                      <li>타인의 정보 도용</li>
                      <li>회사가 게시한 정보의 변경</li>
                      <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                      <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                      <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
                  </ul>
              </div>
              <p className="text-gray-400 mt-4 text-xs">* 본 약관은 공정거래위원회 표준약관을 기반으로 작성된 예시입니다.</p>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Shield /> 개인정보처리방침</h2>
            <div className="space-y-6 text-gray-600 text-sm leading-relaxed h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
              <p>EduClass('이하 회사')는 정보통신망 이용촉진 및 정보보호 등에 관한 법률(이하 '정보통신망법') 등 정보통신서비스제공자가 준수하여야 할 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.</p>
              
              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">1. 수집하는 개인정보의 항목 및 수집방법</h4>
                  <p>회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>수집항목: 이름, 이메일, 비밀번호, 학교명, 학년/반 정보</li>
                      <li>서비스 이용 과정에서 발생하는 정보: 접속 로그, 쿠키, 접속 IP 정보</li>
                  </ul>
              </div>

              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">2. 개인정보의 수집 및 이용목적</h4>
                  <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산</li>
                      <li>회원 관리: 본인확인, 개인식별, 불량회원의 부정 이용 방지와 비인가 사용 방지</li>
                      <li>마케팅 및 광고에 활용: 신규 서비스 개발 및 맞춤 서비스 제공</li>
                  </ul>
              </div>

              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">3. 개인정보의 보유 및 이용기간</h4>
                  <p>원칙적으로, 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 아래와 같이 관계법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
                      <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
                      <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
                  </ul>
              </div>

              <div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">4. 개인정보의 파기절차 및 방법</h4>
                  <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체없이 파기합니다.</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>파기절차: 회원님이 회원가입 등을 위해 입력하신 정보는 목적이 달성된 후 별도의 DB로 옮겨져(종이의 경우 별도의 서류함) 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라(보유 및 이용기간 참조) 일정 기간 저장된 후 파기되어집니다.</li>
                      <li>파기방법: 전자적 파일형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
                  </ul>
              </div>
              <p className="text-gray-400 mt-4 text-xs">* 본 방침은 예시이며 실제 서비스 운영 시 법적 검토가 필요합니다.</p>
            </div>
          </div>
        );

      case 'community':
        return (
          <div className="max-w-5xl mx-auto relative">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3"><Users className="text-orange-500" /> 교사 커뮤니티</h2>
              <button 
                onClick={() => setShowWriteModal(true)}
                className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-600 flex items-center gap-2"
              >
                  <PenTool size={18} /> 글쓰기
              </button>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
              {posts.map((post) => (
                <div key={post.id} className="p-6 border-b border-gray-100 hover:bg-orange-50 transition-colors cursor-pointer flex justify-between items-center group">
                  <div>
                    <span className="inline-block px-2 py-1 rounded bg-gray-100 text-gray-500 text-xs font-bold mb-2 mr-2">{post.tag}</span>
                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-orange-600">{post.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">{post.content}</p>
                    <p className="text-xs text-gray-400 mt-2">{post.author} · {new Date(post.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-4 text-gray-400 font-medium items-center">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleLikePost(post.id); }}
                        className="flex items-center gap-1 hover:text-red-500 transition-colors"
                    >
                        <Heart size={16} fill="currentColor" className={post.likes > 0 ? "text-red-500" : ""} /> {post.likes}
                    </button>
                    <span className="flex items-center gap-1"><MessageSquare size={16} /> {post.comments}</span>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                  <div className="text-center py-20 text-gray-400">
                      등록된 게시글이 없습니다.
                  </div>
              )}
            </div>

            {/* Write Modal */}
            {showWriteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg">새 글 작성</h3>
                            <button onClick={() => setShowWriteModal(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <div className="space-y-3">
                            <input 
                                type="text" placeholder="제목" className="w-full border rounded-lg p-2" 
                                value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})}
                            />
                            <div className="flex gap-2">
                                <select 
                                    className="border rounded-lg p-2 text-sm"
                                    value={newPost.tag} onChange={e => setNewPost({...newPost, tag: e.target.value})}
                                >
                                    <option>학급경영</option>
                                    <option>수업자료</option>
                                    <option>서식</option>
                                    <option>Q&A</option>
                                    <option>놀이</option>
                                    <option>잡담</option>
                                </select>
                                <input 
                                    type="text" placeholder="작성자명" className="flex-1 border rounded-lg p-2 text-sm" 
                                    value={newPost.author} onChange={e => setNewPost({...newPost, author: e.target.value})}
                                />
                            </div>
                            <textarea 
                                placeholder="내용을 입력하세요..." className="w-full h-32 border rounded-lg p-2 resize-none"
                                value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})}
                            />
                            <button onClick={handleWritePost} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600">등록하기</button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        );

      case 'materials':
        return (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-3"><Download className="text-blue-500" /> 수업 자료실</h2>
              <p className="text-gray-500 mt-2">선생님들이 직접 만든 고퀄리티 수업 자료를 공유해보세요.</p>
              
              <div className="mt-6">
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-100 text-blue-600 px-6 py-2 rounded-full font-bold hover:bg-blue-200 flex items-center gap-2 mx-auto transition-colors"
                  >
                      <Upload size={18} /> 내 자료 올리기
                  </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.map((file, i) => (
                <div key={file.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm border border-blue-100">
                      {file.type}
                    </div>
                    <button 
                        onClick={() => handleDownload(file.id, file.title)}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        <Download size={20}/>
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 h-12">{file.title}</h3>
                  <div className="text-xs text-gray-400 font-medium flex justify-between">
                      <span>{file.size}</span>
                      <span>다운로드 {file.downloadCount}회</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'news':
        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-3"><Newspaper className="text-red-500" /> 에듀테크 뉴스</h2>
            
            {loadingNews && newsItems.length === 0 ? (
                <div className="py-20 text-center text-gray-400">
                    <Loader2 size={48} className="mx-auto mb-4 animate-spin text-red-300" />
                    <p>최신 뉴스를 불러오고 있습니다...</p>
                </div>
            ) : (
                <div className="space-y-8">
                {newsItems.map((news, i) => (
                    <div key={i} onClick={() => window.open(news.url, '_blank')} className="flex flex-col md:flex-row gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group">
                    <img src={news.img} alt="news" className="w-full md:w-48 h-32 object-cover rounded-xl bg-gray-200" />
                    <div className="flex-1 py-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">HOT ISSUE</span>
                            {news.source && <span className="text-xs text-gray-400 font-bold">• {news.source}</span>}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-500 transition-colors">{news.title}</h3>
                        <p className="text-gray-600 text-sm line-clamp-2 mb-3">{news.desc}</p>
                        <span className="text-xs text-gray-400">{news.date}</span>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        );

      default:
        return <div className="text-center py-20">페이지를 찾을 수 없습니다.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <header className="bg-white p-4 shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto w-full flex items-center">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} /> 돌아가기
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-5xl mx-auto animate-fade-in-up">
          {renderContent()}
        </div>
      </main>
      <footer className="bg-white border-t p-8 text-center text-gray-400 text-sm mt-auto">
        &copy; 2025 EduClass Helper. All rights reserved.
      </footer>
    </div>
  );
};
