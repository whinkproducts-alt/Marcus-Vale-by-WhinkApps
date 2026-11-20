import React from 'react';

export const BRAND_ASSETS = {
  marcus: '/brand/marcus-vale.webp',
  apps: '/brand/whink-apps.webp',
  group: '/brand/whink-group.webp',
  resumeEngine: '/brand/resume-engine.svg',
};

export function BrandMark({size=44, className=''}:{size?:number;className?:string}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 80 80" role="img" aria-label="Marcus Vale logo" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mv-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFF2B9"/><stop offset=".48" stopColor="#D6AA57"/><stop offset="1" stopColor="#A37435"/></linearGradient>
      <linearGradient id="mv-blue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#76DFFB"/><stop offset=".55" stopColor="#3187EE"/><stop offset="1" stopColor="#144FA6"/></linearGradient>
    </defs>
    <circle cx="40" cy="40" r="37" fill="#081421" stroke="url(#mv-gold)" strokeWidth="2"/>
    <path d="M18 56V24l22 22 22-22v32" fill="none" stroke="#4f3517" strokeWidth="10" strokeLinejoin="round"/>
    <path d="M18 56V24l22 22 22-22v32" fill="none" stroke="url(#mv-gold)" strokeWidth="6.5" strokeLinejoin="round"/>
    <ellipse cx="40" cy="40" rx="34" ry="13" fill="none" stroke="url(#mv-blue)" strokeWidth="2.8" transform="rotate(-16 40 40)"/>
    <path d="M28 30 40 43 52 30" fill="none" stroke="#96e8ff" strokeWidth="1.5" opacity=".8"/>
    <circle cx="70" cy="31" r="3.8" fill="#FFF2B9" stroke="#D6AA57" strokeWidth="1.4"/>
  </svg>;
}

export function MarcusPortrait({className=''}:{className?:string}) {
  return <div className={'marcus-portrait '+className}>
    <div className="portrait-fallback" aria-hidden="true">MV</div>
    <img src={BRAND_ASSETS.marcus} alt="Marcus Vale, official executive-assistant portrait" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}} />
  </div>;
}

export function BrandPartners() {
  return <div className="brand-partners" aria-label="Affiliated brands">
    <a href="https://github.com/whinkproducts-alt/ECHELON-INTEGRATIONS" rel="noreferrer" target="_blank" title="WHINK Group">
      <img src={BRAND_ASSETS.group} alt="WHINK Group" loading="lazy" />
    </a>
    <a href="https://github.com/whinkproducts-alt" rel="noreferrer" target="_blank" title="WHINK Apps">
      <img src={BRAND_ASSETS.apps} alt="WHINK Apps" loading="lazy" />
    </a>
    <span className="brand-tile" title="Resume Engine">
      <img src={BRAND_ASSETS.resumeEngine} alt="Resume Engine" loading="lazy" />
    </span>
  </div>;
}
