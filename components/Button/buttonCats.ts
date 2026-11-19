/**
 * Cat artwork + animation CSS for <Button catAnimation />.
 * Markup is static, author-controlled SVG (safe for dangerouslySetInnerHTML).
 * All classes / keyframes are prefixed "mbc-" so nothing leaks into the app.
 */

export type IdleCatKey =
  | "popup" | "peek" | "eyes" | "walk" | "bounce" | "paw" | "sleep" | "flat" | "tail";
export type CatKey = IdleCatKey | "surp" | "atk";
export interface CatDef {
  name: string;
  /** fixed length in ms (reaction cats only; idle cats get a random dwell) */
  duration?: number;
  /** returns SVG inner markup for a 190x100 box; w = button width in px */
  render: (w: number) => string;
}
export const IDLE_CATS: IdleCatKey[] = ["popup","peek","eyes","walk","bounce","paw","sleep","flat","tail"];

const E=(r=6,pr=4.2)=>`<g class=mbc-ee><circle r=${r} fill=#CBEF92 /><g class=mbc-pu><circle r=${pr} cx=.4 cy=.4 fill=#050604 /><circle r=1.4 cx=-1 cy=-1.4 fill=#fff /></g></g>`;
const EP=(y:number,a:string,b?:string)=>`<g transform="translate(22 ${y})">${a}</g><g transform="translate(48 ${y})">${b||a}</g>`;
const NZ='<path d="M32 31l3 3.2 3-3.2Z" fill=#3b4533 />';
const EARS='<path d="M8 12L21 17L8 29Z" fill=#1f261a /><path d="M62 12L49 17L62 29Z" fill=#1f261a />';
/** body hidden behind the button: shows (complete, not cut off) when the button is squished */
const BD=()=>''; // no visible body: the cat rides the button surface instead
const O=EP(26,E())+NZ,WIDE=EP(26,'<circle r=7.5 fill=#CBEF92 /><circle r=2.4 cy=.5 fill=#050604 />')+NZ;
const HP='<path class=mbc-l d="M16 28l6-5 6 5M42 28l6-5 6 5"/>'+NZ,SL2='<path class=mbc-l d="M14 18l8 4-8 4M56 18l-8 4 8 4"/>';
const HD='<path class=mbc-k d="M3 60L3 44L5 6Q6 2 10 4L26 14Q35 12 44 14L60 4Q64 2 65 6L67 44L67 60Z"/>';
const IN=(c:string)=>`<g class=mbc-in>${c}</g>`;
const H=(e:string,x=60,y=56,x2='',body='')=>`<g class=mbc-in>${body}<g transform="translate(${x} ${y})"><g class=mbc-h>${HD}${EARS}${e}${x2}</g></g></g>`;
const SP='<g class=mbc-sp><path d="M132 58l5-4M134 66l7-2"/></g>';
const AR='<g class=mbc-sp><path d="M52 74q-5 4-1 10M46 72q-6 6-1 14M138 74q5 4 1 10M144 72q6 6 1 14"/></g>';
const PW='<g class=mbc-pa><ellipse class=mbc-k cx=62 cy=88 rx=8 ry=6 /><ellipse class=mbc-k cx=128 cy=88 rx=8 ry=6 /></g>';
const PAW='<g class=mbc-pw><ellipse class=mbc-k cx=62 cy=34 rx=8 ry=7.5 stroke=#ADEB66 stroke-width=1.2 /></g>';
const PP='<g class="mbc-pp mbc-k" transform="translate(142 52)"><ellipse cy=4 rx=4 ry=3.4 /><circle cx=-5 cy=-2 r=1.7 /><circle cx=-1.7 cy=-5 r=1.7 /><circle cx=1.7 cy=-5 r=1.7 /><circle cx=5 cy=-2 r=1.7 /></g>';
const EA='<path d="M10 17L30 26Q28 33 19 33Q10 29 10 17Z" fill=#E3F7C0 /><circle cx=20 cy=27 r=3 fill=#050604 /><path d="M60 17L40 26Q42 33 51 33Q60 29 60 17Z" fill=#E3F7C0 /><circle cx=50 cy=27 r=3 fill=#050604 />';
const MO='<path d="M27 33q8 3 16 0q-1 11-8 12q-7-1-8-12Z" fill=#E8687A /><path d="M30 39q5 5 10 0q-2 4-5 4q-3 0-5-4Z" fill=#F6A1AE /><path d="M28 33l2 5 2-5ZM38 33l2 5 2-5Z" fill=#fff />';
const PWA=(x:number)=>`<ellipse class=mbc-k cx=${x} cy=84 rx=10.5 ry=12 stroke=#ADEB66 stroke-width=1.2 /><ellipse cx=${x} cy=88 rx=4.5 ry=3.6 fill=#2b3326 /><circle cx=${x-6} cy=79 r=2 fill=#2b3326 /><circle cx=${x} cy=76 r=2 fill=#2b3326 /><circle cx=${x+6} cy=79 r=2 fill=#2b3326 /><path d="M${x-6} 73l-1-5M${x} 71v-6M${x+6} 73l1-5" stroke=#E3F7C0 stroke-width=1.4 stroke-linecap=round />`;
const MK=(x:number)=>`<path pathLength=1 d="M${x} 98l10 24"/><path pathLength=1 d="M${x+8} 96l10 24"/><path pathLength=1 d="M${x+16} 98l10 24"/>`;
const SCR=`<g class=mbc-gpo><g class=mbc-rl>${PWA(64)}</g><g class=mbc-rr>${PWA(126)}</g></g><g class="mbc-mk mbc-mkl">${MK(46)}</g><g class="mbc-mk mbc-mkr">${MK(110)}</g>`;
const HEARTS='<g class=mbc-hearts opacity=0><g transform="translate(46 70)"><path class=mbc-hr d="M0 6C-8-2-4-10 0-4C4-10 8-2 0 6Z" /></g><g transform="translate(144 66)"><path class=mbc-hr style="animation-delay:.6s" d="M0 6C-8-2-4-10 0-4C4-10 8-2 0 6Z" /></g></g>';
/** arm + paw that follows the cursor (peek = gentle catch, paw = hard slap) */
const CP=(c:string)=>`<g class=mbc-cp opacity=0><g class="mbc-cpi ${c}"><rect class=mbc-k x=-5 y=80 width=10 height=70 rx=5 /><ellipse class=mbc-k cx=0 cy=78 rx=9 ry=8 stroke=#ADEB66 stroke-width=1.2 /><ellipse cx=0 cy=80 rx=3.6 ry=2.8 fill=#2b3326 /><circle cx=-4.5 cy=74 r=1.7 fill=#2b3326 /><circle cx=0 cy=72.5 r=1.7 fill=#2b3326 /><circle cx=4.5 cy=74 r=1.7 fill=#2b3326 /></g><g class=mbc-imp opacity=0><path d="M-18 84l-7-2M18 84l7-2M-10 76l-4-5M10 76l4-5" /></g></g>`;
const ARMS='<g class="mbc-arm mbc-al" opacity=0><g class=mbc-armi><rect class=mbc-k x=57 y=62 width=10 height=30 rx=5 /><ellipse class=mbc-k cx=62 cy=62 rx=8.5 ry=8 stroke=#ADEB66 stroke-width=1.2 /><ellipse cx=62 cy=64 rx=3.6 ry=2.8 fill=#2b3326 /><circle cx=57.5 cy=59 r=1.7 fill=#2b3326 /><circle cx=62 cy=57.5 r=1.7 fill=#2b3326 /><circle cx=66.5 cy=59 r=1.7 fill=#2b3326 /></g></g><g class="mbc-arm mbc-ar" opacity=0><g class=mbc-armi><rect class=mbc-k x=123 y=62 width=10 height=30 rx=5 /><ellipse class=mbc-k cx=128 cy=62 rx=8.5 ry=8 stroke=#ADEB66 stroke-width=1.2 /><ellipse cx=128 cy=64 rx=3.6 ry=2.8 fill=#2b3326 /><circle cx=123.5 cy=59 r=1.7 fill=#2b3326 /><circle cx=128 cy=57.5 r=1.7 fill=#2b3326 /><circle cx=132.5 cy=59 r=1.7 fill=#2b3326 /></g></g>';
const LOAF='<g class=mbc-br><ellipse class=mbc-k cx=95 cy=93 rx=70 ry=15 /></g>';
const SLEEP_E='<g class=mbc-es>'+SL2+'</g><g class=mbc-sleep-eyes opacity=0><svg class=mbc-sleep-eye x=14 y=17 width=12 height=10 viewBox="0 0 12 10"><path class=mbc-sleep-wave d="M-12 5C-9 0-3 0 0 5S6 10 12 5S18 0 24 5S30 10 36 5"/></svg><svg class=mbc-sleep-eye x=44 y=17 width=12 height=10 viewBox="0 0 12 10"><path class=mbc-sleep-wave d="M-12 5C-9 0-3 0 0 5S6 10 12 5S18 0 24 5S30 10 36 5" style="animation-delay:-.32s"/></svg></g>'+NZ;
const V:Record<CatKey,CatDef>={
 popup:{name:'Cat Pop Up (eyes follow cursor)',render:()=>H(O,60,52,'',BD())+IN(SP)},
 peek:{name:'Peek & Hide (hover: tries to catch cursor, click: surprised)',render:()=>IN(PW+ARMS)+H(O,60,70,'',BD())},
 eyes:{name:'Cat Eyes, then pops up (hover: hunting pupils + pounce wiggle)',render:()=>`<g class=mbc-ey><g transform="translate(82 76) scale(1.25)">${E()}</g><g transform="translate(108 76) scale(1.25)">${E()}</g></g>`+H(O,60,52,'',BD())+IN(SP)},
 walk:{name:'Cat Side Peek (runs from the cursor)',render:(W:number)=>{const x=95-W/2+4;return `<g class=mbc-run><g class=mbc-flip style="transform-origin:${x+35}px 80px">`+H(O,x,62,'',BD())+`<g class=mbc-in><ellipse class=mbc-k cx=${x+62} cy=89 rx=8 ry=6 stroke=#ADEB66 stroke-width=1.2 /></g><g class=mbc-in><g class=mbc-sp><path d="M${x-6} 74q-5 4-1 10M${x-12} 72q-6 6-1 14"/></g></g></g></g>`}},
 bounce:{name:'Cat Head Bounce (hover: bounces faster + hearts)',render:()=>H(HP,60,52,'',BD())+IN(AR+HEARTS)},
 paw:{name:'Playful Paw (hover: watches + slaps the cursor)',render:()=>CP('mbc-slap')+H(O,60,52,PAW,BD())+IN(PP)},
 sleep:{name:'Cat Sleep (hover: disturbed ~ ~, click: angry scratch)',render:()=>IN(LOAF+'<ellipse class=mbc-k cx=36 cy=90 rx=10 ry=6.5 stroke=#ADEB66 stroke-width=1 /><ellipse class=mbc-k cx=154 cy=90 rx=10 ry=6.5 stroke=#ADEB66 stroke-width=1 /><g class=mbc-tw style="transform-origin:160px 92px"><path class=mbc-tp style="stroke-width:7" d="M160 90Q184 92 182 72Q180 58 166 63"/></g><text class=mbc-z x=122 y=62>z</text><text class=mbc-z style="animation-delay:1s" x=132 y=50>Z</text>')+H(SLEEP_E,50,62)},
 flat:{name:'Smashed / Flattened (hover: squirms to get free)',render:(W:number)=>{const hw=Math.min(76,Math.max(52,W/2-4)),L=95-hw,R=95+hw;return IN(`<g class=mbc-fb><path class=mbc-k d="M${L} 100Q${L} 72 ${L+26} 70L${L+38} 58L${L+50} 69Q95 65 ${R-50} 69L${R-38} 58L${R-26} 70Q${R} 72 ${R} 100Z"/><g class=mbc-ee><path class=mbc-l d="M80 77l8 4-8 4M110 77l-8 4 8 4"/></g><path d="M92 85l3 3.2 3-3.2Z" fill=#3b4533 /></g><g class=mbc-pa><ellipse class=mbc-k cx=${L+14} cy=90 rx=13 ry=5.5 stroke=#ADEB66 stroke-width=1 /><ellipse class=mbc-k cx=${R-14} cy=90 rx=13 ry=5.5 stroke=#ADEB66 stroke-width=1 /></g><path class=mbc-sp d="M${R-22} 50l4-9 4 6 4-9 5 7"/>`)}},
 tail:{name:'Tail Wag (hover: tail swats the arrow)',render:(W:number)=>{const t=Math.round(95+W/2-38);return H('',60,66,'',BD())+`<g class=mbc-in><g class=mbc-tw style="transform-origin:${t}px 100px"><path class=mbc-tp d="M${t} 100V80Q${t} 62 ${t-16} 62Q${t-25} 62 ${t-24} 70"/></g></g>`+IN(`<g class=mbc-sp><path d="M${t+14} 68q5 4 2 10M${t+19} 66q6 6 2 14"/></g>`)}},
 surp:{name:'Reaction: surprised',duration:1400,render:()=>PW+H(WIDE,60,70,'',BD())+'<text class=mbc-ex x=124 y=52>!</text>'},
 atk:{name:'Reaction: angry cute scratch',duration:3400,render:()=>'<g class=mbc-gp><g class=mbc-tw style="transform-origin:150px 100px"><path class=mbc-tp d="M150 100V78Q150 60 134 60Q125 60 126 68"/></g></g>'+H(EA+MO,60,46,'',BD())+'<g transform="rotate(-12 18 30)"><text class=mbc-mw x=18 y=30>MEOWW!!</text></g><path class=mbc-sp style="stroke-width:3" d="M26 54l12 16M14 66l17 7"/><path class=mbc-sp d="M158 42l7 7M165 40l-5 9M158 49l9-3"/>'}
};
const LD=(tail:boolean)=>H(O,60,52,'',BD())+'<g><ellipse class=mbc-k cx=66 cy=88 rx=9 ry=6 /><ellipse class=mbc-k cx=124 cy=88 rx=9 ry=6 /></g>'+(tail?'<g class=mbc-tw><path class=mbc-tp d="M150 100V78Q150 60 134 60Q125 60 126 68"/></g>':'');
export const CATS = V;
/** where the eyes sit in the 190x100 cat box (for cursor-following pupils) */
export const catFocus = (key: CatKey, w: number) => ({
  x: key === "walk" ? 95 - w / 2 + 39 : key === "sleep" ? 85 : 95,
  y: key === "peek" ? 84 : 78,
});
/** how far the side-peek cat travels when it runs to the other side */
export const runDistance = (w: number) => Math.max(0, w - 78);
/** static clip (used by the SVG exports): only what is above the button's top edge */
export const catClipPath: (width: number) => string = () => `path("M -400 -300 H 600 V 91 H -400 Z")`;
export const SCRATCH_OVERLAY = SCR;
export const loadingCatMarkup = LD;

const FURS=[[81.5,27,6.2,7.7,-22],[89.5,19.5,6,8,-7],[100.5,19.5,6,8,7],[108.5,27,6.2,7.7,22]],PDS=[[82.2,27.6,3,3.8,-22],[89.8,20.8,3,4,-7],[100.2,20.8,3,4,7],[107.8,27.6,3,3.8,22]];
const el=(a:number[][])=>a.map(([x,y,rx,ry,r])=>`<ellipse cx=${x} cy=${y} rx=${rx} ry=${ry} transform="rotate(${r} ${x} ${y})" />`).join('');
let rays='';for(let a=0;a<360;a+=30){rays+=`<g transform="rotate(${a} 95 30)">`;for(let i=0;i<3;i++)rays+=`<circle class=mbc-rd style="--dl:${(.07+i*.045).toFixed(3)}s" cx=95 cy=${10-i*6.5} r=${1.5-i*.3} fill=#ADEB66 />`;rays+='</g>'}

export const slamDefs=(u:string)=>`<linearGradient id="${u}f" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="48"><stop offset="0" stop-color="#3a4132"/><stop offset=".55" stop-color="#0b0c09"/><stop offset="1" stop-color="#000"/></linearGradient><radialGradient id="${u}p" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#7a8868"/><stop offset=".5" stop-color="#272c21"/><stop offset="1" stop-color="#0d0f0a"/></radialGradient>`;
export const slamBody=(u:string)=>`<ellipse class="mbc-sh" cx="95" cy="34" rx="22" ry="13" fill="#000" fill-opacity=".6"/>${rays}<g class="mbc-pawg"><path d="M84 16C84 5 88 -6 95 -10C102 -6 106 5 106 16Z" fill="#0b0c09"/><g fill="url(#${u}f)"><ellipse cx="95" cy="37" rx="12.5" ry="10.5"/>${el(FURS)}</g><g fill="url(#${u}p)"><path d="M95 31.5C100 31.5 105 35.5 104 39.5C103 43.5 98.5 42.5 95 41.2C91.5 42.5 87 43.5 86 39.5C85 35.5 90 31.5 95 31.5Z"/>${el(PDS)}</g><g fill="#FCFDF8" fill-opacity=".85"><path d="M88.3 13.5Q89.5 8 91.5 12.6Z"/><path d="M98.5 12.6Q100.5 8 101.7 13.5Z"/><path d="M77.6 21.5Q73.5 17 80.5 19Z"/><path d="M112.4 21.5Q116.5 17 109.5 19Z"/></g></g>`;

export const CAT_CSS = `
.mbc-k{fill:var(--mbc-cat,#000)}.mbc-l{fill:none;stroke:#ADEB66;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mbc-sp{fill:none;stroke:var(--mbc-cat,#000);stroke-width:1.8;stroke-linecap:round;animation:mbc-bl3 3.2s infinite}
.mbc-tp{fill:none;stroke:var(--mbc-cat,#000);stroke-width:9;stroke-linecap:round}
.mbc-z{font:800 11px 'DM Sans',sans-serif;fill:#8fcf3f;animation:mbc-zz 2s infinite both}
.mbc-ex,.mbc-mw{font:800 20px 'DM Sans',sans-serif;fill:var(--mbc-cat,#000)}.mbc-mw{font-size:22px}
.mbc-h,.mbc-pw,.mbc-ee,.mbc-br{transform-box:fill-box;transform-origin:50% 100%}.mbc-ee,.mbc-mw,.mbc-sp,.mbc-ex{transform-box:fill-box;transform-origin:center}
.mbc-tw,.mbc-pl,.mbc-pr{transform-box:view-box}.mbc-tw{transform-origin:150px 100px}.mbc-pl{transform-origin:56px 98px}.mbc-pr{transform-origin:134px 98px}
.mbc-ee{animation:mbc-blink3 5s infinite;animation-delay:var(--bd,0s)}.mbc-pu{animation:mbc-look3 7s infinite;animation-delay:var(--bd,0s)}
.mbc-in{animation:mbc-enter .8s both,mbc-exit .45s ease-in calc(var(--d) - .45s) forwards}
.mbc-v-walk .mbc-in{animation-name:mbc-enterW,mbc-exitW}
.mbc-v-eyes .mbc-in{animation-delay:1.7s,calc(var(--d) - .45s)}
.mbc-v-surp .mbc-in,.mbc-v-atk .mbc-in,.mbc-v-ld .mbc-in{animation:none}
.mbc-v-popup .mbc-h,.mbc-v-eyes .mbc-h,.mbc-v-paw .mbc-h{animation:mbc-sway 3.6s ease-in-out infinite}
.mbc-v-peek .mbc-h{animation:mbc-peekl 4.4s ease-in-out infinite}
.mbc-v-walk .mbc-h{animation:mbc-tilt 3.8s ease-in-out infinite}.mbc-v-walk .mbc-pu{animation:none;transform:translateX(1.8px)}
.mbc-v-bounce .mbc-h{animation:mbc-bnc 1.3s ease-in-out infinite}
.mbc-v-paw .mbc-pw{animation:mbc-tapl 3.2s ease-in-out infinite}.mbc-v-paw .mbc-pp{animation:mbc-pps 3.2s infinite}
.mbc-v-sleep .mbc-br{animation:mbc-breathe 3.4s ease-in-out infinite}.mbc-v-sleep .mbc-h{animation:mbc-breathe2 3.4s ease-in-out infinite}.mbc-v-sleep .mbc-tw{animation:mbc-swish 3s ease-in-out infinite alternate}
.mbc-v-tail .mbc-tw{animation:mbc-wag .55s ease-in-out infinite alternate}
.mbc-v-eyes .mbc-ey{animation:mbc-eyeph 1.7s both}
.mbc-v-surp .mbc-h{animation:mbc-surp var(--d) both}.mbc-v-surp .mbc-ex{animation:mbc-pop var(--d) both}.mbc-v-surp .mbc-pa{animation:mbc-pa2 var(--d) both}
.mbc-v-atk .mbc-h{animation:mbc-atkh var(--d) both}.mbc-v-atk .mbc-gp{animation:mbc-gp var(--d) both}.mbc-v-atk .mbc-pl{animation:mbc-swl .38s ease-in-out .5s 6 alternate both}.mbc-v-atk .mbc-pr{animation:mbc-swr .38s ease-in-out .7s 6 alternate both}.mbc-v-atk .mbc-mw,.mbc-v-atk .mbc-sp{animation:mbc-pop2 var(--d) both}.mbc-v-atk .mbc-tw{animation:mbc-wag .35s ease-in-out infinite alternate}
.mbc-v-ld .mbc-h{animation:mbc-bob 1.4s ease-in-out infinite}.mbc-v-ld .mbc-tw{animation:mbc-wag .6s ease-in-out infinite alternate}
.mbc-v-ld .mbc-ee{animation:mbc-blink2 3.2s infinite}.mbc-v-ld .mbc-pu{animation:mbc-look2 4s infinite}
.mbc-cat.mbc-rx .mbc-h{animation:mbc-hop .85s both!important}.mbc-cat.mbc-rx .mbc-tw{animation:mbc-wag .1s ease-in-out infinite alternate!important}
.mbc-cat.mbc-fl .mbc-in{animation:mbc-flee .35s ease-in both!important}
.mbc-cat.mbc-fl .mbc-sp,.mbc-cat.mbc-fl .mbc-z,.mbc-cat.mbc-fl .mbc-pp{animation:none;opacity:0}
@keyframes mbc-enter{0%{transform:translateY(48px)}55%{transform:translateY(-7px) scale(.98,1.04)}75%{transform:translateY(1px) scale(1.02,.98)}100%{transform:none}}
@keyframes mbc-exit{to{transform:translateY(64px)}}
@keyframes mbc-enterW{0%{transform:translateX(-120px) rotate(-12deg)}55%{transform:translateX(7px) rotate(3deg)}78%{transform:translateX(-2px)}100%{transform:none}}
@keyframes mbc-exitW{to{transform:translateX(-120px) rotate(-12deg)}}
@keyframes mbc-sway{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg) translateY(-1px)}}
@keyframes mbc-peekl{0%,100%{transform:none}25%,40%{transform:translateY(-8px)}48%{transform:translateY(-8px) rotate(-3deg)}58%{transform:translateY(-8px) rotate(3deg)}70%{transform:translateY(-2px)}}
@keyframes mbc-tilt{0%,100%{transform:rotate(1deg)}50%{transform:rotate(7deg)}}
@keyframes mbc-bnc{0%,100%{transform:none}25%{transform:translateY(-10px) scale(.96,1.06)}50%{transform:scale(1.06,.92)}70%{transform:none}}
@keyframes mbc-tapl{0%,45%,100%{transform:translateY(2px) rotate(-8deg)}5%,15%,25%,35%{transform:translateY(-6px) rotate(10deg)}10%,20%,30%,40%{transform:translateY(2px) rotate(-8deg)}}
@keyframes mbc-pps{0%,8%{opacity:0}16%,60%{opacity:1}70%,100%{opacity:0}}
@keyframes mbc-breathe{50%{transform:scaleY(1.1)}}@keyframes mbc-breathe2{50%{transform:translateY(-1.5px)}}
@keyframes mbc-swish{from{transform:rotate(-8deg)}to{transform:rotate(10deg)}}
@keyframes mbc-flatin{to{transform:translateY(10px) scale(1.3,.5)}}
@keyframes mbc-flatl{0%,100%{transform:translateY(10px) scale(1.3,.5)}50%{transform:translateY(10px) scale(1.27,.55)}}
@keyframes mbc-eyeph{0%{opacity:0;transform:translateY(12px) scale(.6)}15%{opacity:1;transform:scale(1.1)}25%{transform:none}50%{transform:scaleY(.1)}58%{transform:none}85%{opacity:1}100%{opacity:0}}
@keyframes mbc-wag{from{transform:rotate(-12deg)}to{transform:rotate(14deg)}}
@keyframes mbc-bob{50%{transform:translateY(-3px)}}
@keyframes mbc-zz{0%{opacity:0;transform:translateY(6px)}30%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
@keyframes mbc-bl3{0%,10%{opacity:0}15%,30%{opacity:1}35%,60%{opacity:0}65%,80%{opacity:1}85%,100%{opacity:0}}
@keyframes mbc-blink3{0%,92%,100%{transform:none}95%{transform:scaleY(.1)}}
@keyframes mbc-blink2{0%,92%,100%{transform:none}96%{transform:scaleY(.1)}}
@keyframes mbc-look3{0%,20%,100%{transform:none}30%,45%{transform:translateX(-1.6px)}55%,70%{transform:translateX(1.6px)}}
@keyframes mbc-look2{0%,30%,100%{transform:none}40%,60%{transform:translateX(-1.6px)}70%,90%{transform:translateX(1.6px)}}
@keyframes mbc-hop{0%{transform:none}25%{transform:translateY(-12px) scale(.95,1.08)}45%{transform:scale(1.07,.9)}65%{transform:translateY(-8px)}85%,100%{transform:none}}
@keyframes mbc-surp{0%{transform:none}12%{transform:translateY(-16px) scale(1.12,1.18)}40%{transform:translateY(-12px) scale(1.05)}64%{transform:translateY(-12px)}82%,100%{transform:translateY(60px)}}
@keyframes mbc-pop{0%,8%{transform:scale(0);opacity:0}18%{transform:scale(1.4);opacity:1}28%,62%{transform:none;opacity:1}72%,100%{opacity:0}}
@keyframes mbc-pop2{0%,8%{transform:scale(0);opacity:0}18%{transform:scale(1.3);opacity:1}26%,72%{transform:none;opacity:1}82%,100%{opacity:0}}
@keyframes mbc-pa2{0%,70%{transform:none}100%{transform:translateY(10px)}}
@keyframes mbc-atkh{0%{transform:translateY(22px)}8%{transform:translateY(-8px) scale(1.15,1.2)}14%{transform:scale(1.15)}22%{transform:scale(1.15) rotate(-5deg)}34%{transform:scale(1.15) rotate(5deg)}46%{transform:scale(1.15) rotate(-5deg)}58%{transform:scale(1.15) rotate(4deg)}70%{transform:scale(1.15)}82%{transform:translateY(0)}100%{transform:translateY(60px)}}
@keyframes mbc-gp{0%{transform:translateY(34px)}8%,84%{transform:none}100%{transform:translateY(60px)}}
@keyframes mbc-swl{from{transform:rotate(8deg)}to{transform:rotate(-16deg)}}
@keyframes mbc-swr{from{transform:rotate(-8deg)}to{transform:rotate(16deg)}}
@keyframes mbc-flee{to{transform:translateY(64px)}}
.mbc-scr{position:absolute;left:50%;margin-left:-95px;top:-88px;width:190px;height:100px;overflow:visible;pointer-events:none;z-index:4}
.mbc-mk{fill:none;stroke:#ADEB66;stroke-width:2.2;stroke-linecap:round}.mbc-mk path{stroke-dasharray:1}
.mbc-rl,.mbc-rr{transform-box:view-box}.mbc-rl{transform-origin:64px 80px}.mbc-rr{transform-origin:126px 80px}
.mbc-scr.mbc-v-atk{animation:mbc-scrfade var(--d) both}.mbc-v-atk .mbc-gpo{animation:mbc-gp var(--d) both}
.mbc-v-atk .mbc-rl{animation:mbc-rakeL .3s ease-in .6s 6 both}.mbc-v-atk .mbc-rr{animation:mbc-rakeR .3s ease-in .75s 6 both}
.mbc-v-atk .mbc-mkl{animation:mbc-mk .3s ease-out .6s 6 both}.mbc-v-atk .mbc-mkr{animation:mbc-mk .3s ease-out .75s 6 both}
@keyframes mbc-rakeL{0%,100%{transform:translate(0,-4px) rotate(8deg)}40%,55%{transform:translate(-8px,24px) rotate(-10deg)}}
@keyframes mbc-rakeR{0%,100%{transform:translate(0,-4px) rotate(-8deg)}40%,55%{transform:translate(8px,24px) rotate(10deg)}}
@keyframes mbc-mk{0%,38%{stroke-dashoffset:1;opacity:0}52%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:.85}}
@keyframes mbc-scrfade{0%,88%{opacity:1}100%{opacity:0}}

/* hovering = the cat stays: pause the leave animation (2nd in the list) only */
.mbc-hov .mbc-in{animation-play-state:running,paused}
.mbc-run{transform:translateX(calc(var(--run,0)*1px));transition:transform .55s cubic-bezier(.34,1.45,.5,1)}
.mbc-flip{transform-box:view-box;transform:scaleX(var(--flip,1))}
.mbc-cp{transform:translateX(calc(var(--cpx,95)*1px));transition:transform .18s ease-out}
.mbc-cpi{transform-box:view-box;transform-origin:0 100px;transform:translateY(30px)}
.mbc-imp{fill:none;stroke:var(--mbc-cat,#000);stroke-width:2;stroke-linecap:round}
.mbc-hr{fill:#ADEB66;transform-box:fill-box;transform-origin:center;animation:mbc-heart 1.4s infinite both}
.mbc-sleep-eye{overflow:hidden}.mbc-sleep-wave{fill:none;stroke:#ADEB66;stroke-width:2;stroke-linecap:round}.mbc-v-sleep .mbc-es,.mbc-v-sleep .mbc-sleep-eyes{transition:opacity .35s ease}
.mbc-hov.mbc-v-popup .mbc-pu,.mbc-hov.mbc-v-peek .mbc-pu,.mbc-hov.mbc-v-paw .mbc-pu,.mbc-hov.mbc-v-walk .mbc-pu,.mbc-hov.mbc-v-bounce .mbc-pu{animation:none;transform:translate(calc(var(--lx,0)*1px),calc(var(--ly,0)*1px));transition:transform .12s ease-out}
.mbc-hov.mbc-v-eyes .mbc-pu{animation:none;transform:translate(calc(var(--lx,0)*.8px),calc(var(--ly,0)*.8px)) scale(1.35);transition:transform .12s ease-out}
.mbc-hov.mbc-v-eyes .mbc-h{animation:mbc-pounce .45s ease-in-out infinite}
.mbc-hov.mbc-v-paw .mbc-cp{opacity:1}
.mbc-hov.mbc-v-paw .mbc-cpi{animation:mbc-slap .9s ease-in infinite}
.mbc-hov.mbc-v-paw .mbc-imp{animation:mbc-imp .9s infinite}
.mbc-hov.mbc-v-bounce .mbc-h{animation:mbc-bnc .65s ease-in-out infinite}
.mbc-hov.mbc-v-bounce .mbc-hearts{opacity:1}
.mbc-hov.mbc-v-sleep .mbc-es{opacity:0}
.mbc-hov.mbc-v-sleep .mbc-sleep-eyes{opacity:1}
.mbc-hov.mbc-v-sleep .mbc-sleep-wave{animation:mbc-wriggle 1.6s ease-in-out infinite alternate}
.mbc-hov.mbc-v-sleep .mbc-h{animation:mbc-grumble 1.8s ease-in-out infinite}
.mbc-hov.mbc-v-sleep .mbc-tw{animation:mbc-swish 1.2s ease-in-out infinite alternate}
.mbc-hov.mbc-v-flat .mbc-pa{animation:mbc-paddle .25s ease-in-out infinite alternate}
.mbc-hov.mbc-v-flat .mbc-sp{animation:mbc-pulse .4s ease-in-out infinite alternate}
.mbc-hov.mbc-v-tail .mbc-tw{animation:mbc-wagf .2s ease-in-out infinite alternate}
@keyframes mbc-pounce{0%,100%{transform:translateY(3px) rotate(-2deg)}50%{transform:translateY(5px) rotate(2deg)}}
@keyframes mbc-catch{0%,100%{transform:translateY(30px)}22%{transform:translateY(-4px) rotate(-8deg)}38%{transform:translateY(-8px) rotate(8deg)}52%{transform:translateY(-4px) scale(1.1)}62%{transform:translateY(-2px) scale(.86)}78%{transform:translateY(30px)}}
@keyframes mbc-slap{0%,100%{transform:translateY(30px)}18%{transform:translateY(-16px) rotate(-6deg)}34%{transform:translateY(-16px)}44%{transform:translateY(7px) scale(1.15,.8)}54%{transform:translateY(5px) scale(1.1,.85)}74%{transform:translateY(30px)}}
@keyframes mbc-imp{0%,42%{opacity:0}46%,60%{opacity:1}70%,100%{opacity:0}}
@keyframes mbc-heart{0%{opacity:0;transform:translateY(8px) scale(.5)}30%{opacity:1}100%{opacity:0;transform:translateY(-16px) scale(1.1)}}
@keyframes mbc-wriggle{from{transform:translateX(0)}to{transform:translateX(-1.5px)}}
@keyframes mbc-grumble{0%,100%{transform:rotate(-.6deg)}50%{transform:rotate(.6deg) translateY(.3px)}}
@keyframes mbc-shiver{0%,100%{transform:translateX(-1px)}50%{transform:translateX(1px)}}
@keyframes mbc-flat-wriggle{0%,100%{transform:translateY(9px) scale(1.3,.5) rotate(-1deg)}50%{transform:translateY(10px) scale(1.3,.5) rotate(1deg)}}
@keyframes mbc-paddle{from{transform:translateX(-3px) rotate(-6deg)}to{transform:translateX(3px) rotate(6deg)}}
@keyframes mbc-pulse{from{transform:scale(1);opacity:.6}to{transform:scale(1.3);opacity:1}}
@keyframes mbc-wagf{from{transform:rotate(-22deg)}to{transform:rotate(24deg)}}
.mbc-in{transform-box:view-box;transform-origin:95px 100px}
.mbc-v-flat .mbc-in{animation-name:mbc-drop,mbc-exit;transform-box:fill-box;transform-origin:50% 100%}
.mbc-fb{transform-box:fill-box;transform-origin:50% 100%;animation:mbc-flatb 3.2s ease-in-out infinite}
.mbc-hov.mbc-v-flat .mbc-fb{animation:mbc-squirm2 .5s ease-in-out infinite}
.mbc-armi{transform-box:view-box;transform:scaleY(.15)}
.mbc-al .mbc-armi{transform-origin:62px 90px;--a:var(--angl,0)}
.mbc-ar .mbc-armi{transform-origin:128px 90px;--a:var(--angr,0)}
.mbc-hov.mbc-v-peek[data-side=l] .mbc-al,.mbc-hov.mbc-v-peek[data-side=r] .mbc-ar{opacity:1}
.mbc-hov.mbc-v-peek[data-side=l] .mbc-al .mbc-armi,.mbc-hov.mbc-v-peek[data-side=r] .mbc-ar .mbc-armi{animation:mbc-reach 1.7s ease-in-out infinite}
@keyframes mbc-drop{0%{opacity:0;transform:translateY(-36px) scale(.92,1.12)}55%{opacity:1;transform:translateY(0) scale(1.18,.72)}78%{transform:scale(.97,1.05)}100%{transform:none}}
@keyframes mbc-flatb{0%,100%{transform:none}50%{transform:scaleY(1.07)}}
@keyframes mbc-squirm2{0%,100%{transform:none}25%{transform:rotate(-2deg) scale(1.03,.94)}50%{transform:scale(.98,1.08)}75%{transform:rotate(2deg) scale(1.03,.94)}}
@keyframes mbc-reach{0%,100%{transform:rotate(calc(var(--a,0)*.25deg)) scaleY(.15);opacity:0}18%{opacity:1;transform:rotate(calc(var(--a,0)*1deg)) scaleY(1)}34%{transform:rotate(calc(var(--a,0)*1deg - 10deg)) scaleY(1)}46%{transform:rotate(calc(var(--a,0)*1deg + 10deg)) scaleY(1)}58%,70%{transform:rotate(calc(var(--a,0)*1deg)) scaleY(.88)}86%{opacity:1;transform:rotate(calc(var(--a,0)*.25deg)) scaleY(.15)}}
`;
export const SLAM_CSS = `.mbc-slam{position:absolute;left:50%;top:0;width:190px;height:52px;margin-left:-95px;overflow:visible;pointer-events:none;z-index:3}
.mbc-sh,.mbc-rd,.mbc-pawg{opacity:0}.mbc-pawg,.mbc-sh{transform-box:view-box;transform-origin:95px 30px}
.mbc-hit .mbc-pawg{animation:mbc-paw .26s both}.mbc-hit .mbc-sh{animation:mbc-shd .26s both}.mbc-hit .mbc-rd{animation:mbc-ray .32s ease-out var(--dl) both}
@keyframes mbc-paw{0%{transform:translateY(-26px) rotate(-14deg) scale(.35);opacity:0}28%,50%{transform:translateY(0) rotate(3deg) scale(1.12);opacity:1}100%{transform:translateY(-14px) rotate(9deg) scale(1.7);opacity:0}}
@keyframes mbc-shd{0%{transform:scale(1.6);opacity:0}28%,50%{transform:scale(1);opacity:.8}100%{transform:scale(1.6);opacity:0}}
@keyframes mbc-ray{0%{transform:translateY(0);opacity:0}50%{opacity:1}100%{transform:translateY(-9px);opacity:0}}
`;
export const EXTRA_CSS = `.mbc-btn:focus-visible{outline:2px solid #ADEB66;outline-offset:4px;border-radius:26px}
.mbc-dots i{animation:mbc-dt 1s infinite}.mbc-dots i:nth-child(2){animation-delay:.15s}.mbc-dots i:nth-child(3){animation-delay:.3s}
@keyframes mbc-dt{50%{transform:translateY(-3px);opacity:.5}}
@media(prefers-reduced-motion:reduce){.mbc-cat,.mbc-scr,.mbc-slam{display:none!important}}`;
export const FX_CSS = CAT_CSS + SLAM_CSS + EXTRA_CSS;
