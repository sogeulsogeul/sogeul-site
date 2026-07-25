// 내비/스킵 링크: 파일 뷰어 등에서 새 창이 열리는 것을 막고 해당 섹션으로 스크롤 이동
document.querySelectorAll('a[href^="#"]').forEach(function(link){
  link.addEventListener('click', function(e){
    var target = document.getElementById(link.getAttribute('href').slice(1));
    if(!target) return;
    e.preventDefault();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
  });
});
