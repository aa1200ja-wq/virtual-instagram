document.addEventListener('click',function(e){
  const b=e.target.closest('[data-like]');
  if(!b)return;
  b.classList.toggle('is-liked');
  b.textContent=b.classList.contains('is-liked')?'♥':'♡';
});
