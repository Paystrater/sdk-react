// The checkout's one stylesheet. Every class starts ps- and
// sits under .ps-checkout, whose CSS variables carry the theme, so the
// merchant's CSS cannot leak in and ours cannot leak out. It follows the web
// sandbox app (sandbox-app src/app/globals.css and components/ui): surfaces are
// set apart by tone and a hairline edge, never a shadow; buttons are pills;
// fields are 48px with a brand border on focus; notes and badges are tinted.
// Names are capitalized (.ps-name, .ps-merchant-name); headings and labels
// keep their sentence case. It goes in one <style> tag, which takes the
// merchant's nonce under a strict CSP.
export const CSS = `
.ps-checkout{all:initial;display:block;box-sizing:border-box;position:relative;width:100%;max-width:440px;margin:0 auto;padding:24px;background:var(--ps-color-background);color:var(--ps-color-text-body);font-family:var(--ps-font-family);font-size:15px;line-height:22px;border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-card);overflow:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent}
.ps-checkout *,.ps-checkout *::before,.ps-checkout *::after{box-sizing:border-box;font-family:inherit}
.ps-checkout h2,.ps-checkout h3,.ps-checkout p{margin:0}
.ps-checkout ::selection{background:var(--ps-color-primary-soft);color:var(--ps-color-text)}
.ps-name,.ps-merchant-name{text-transform:capitalize}
.ps-ribbon{position:absolute;top:12px;right:12px;padding:3px 8px;font-size:11px;line-height:16px;font-weight:500;color:var(--ps-color-warning);background:var(--ps-color-surface-hover);border-radius:11px}
.ps-header{display:flex;flex-direction:column;gap:4px;margin-bottom:20px}
.ps-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.ps-logo{width:40px;height:40px;flex:none;border-radius:13px;background:var(--ps-color-primary-soft);object-fit:contain;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--ps-color-primary-text);overflow:hidden}
img.ps-logo{background:var(--ps-color-surface);border:1px solid var(--ps-color-border)}
.ps-merchant{flex:1;min-width:0}
.ps-ribbon~.ps-header .ps-merchant{padding-right:72px}
.ps-ribbon~.ps-sr+.ps-stack>.ps-title:first-child{padding-right:88px}
.ps-merchant-name{font-size:16px;line-height:24px;font-weight:600;color:var(--ps-color-text);overflow-wrap:anywhere}
.ps-desc{font-size:13px;line-height:18px;color:var(--ps-color-text-muted);overflow-wrap:anywhere}
.ps-desc::first-letter{text-transform:uppercase}
.ps-amount{font-family:var(--ps-font-family-mono);font-size:26px;line-height:34px;font-weight:600;color:var(--ps-color-primary-text);letter-spacing:-.01em;overflow-wrap:anywhere}
.ps-token{font-family:var(--ps-font-family);font-size:14px;font-weight:500;color:var(--ps-color-text-muted);margin-left:6px;letter-spacing:0}
.ps-label{font-size:12px;line-height:16px;font-weight:500;color:var(--ps-color-text-muted)}
.ps-stack{display:flex;flex-direction:column;gap:12px}
.ps-title{font-size:18px;line-height:26px;font-weight:600;color:var(--ps-color-text);outline:none}
.ps-back{position:relative;display:inline-flex;align-items:center;gap:6px;align-self:flex-start;min-height:32px;margin:4px 0 4px -10px;padding:0 12px 0 10px;font-size:13px;line-height:18px;font-weight:500;letter-spacing:normal;color:var(--ps-color-text-muted);background:transparent;border:0;border-radius:var(--ps-border-radius-button);cursor:pointer;transition:background-color .15s cubic-bezier(.2,.4,0,1),color .15s cubic-bezier(.2,.4,0,1)}
.ps-back:hover{background:var(--ps-color-surface-hover);color:var(--ps-color-text)}
.ps-back svg{flex:none}
.ps-back::before{content:"";position:absolute;inset:-4px 0}
.ps-back-static,.ps-back-static:hover{margin:0;padding:0;cursor:default;background:none;color:var(--ps-color-text-muted)}
.ps-muted{color:var(--ps-color-text-muted);font-size:13px;line-height:18px}
.ps-methods{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.ps-method{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:68px;padding:12px 44px 12px 14px;text-align:left;cursor:pointer;color:var(--ps-color-text);background:var(--ps-color-background);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-surface);transition:background-color .15s cubic-bezier(.2,.4,0,1),border-color .15s cubic-bezier(.2,.4,0,1)}
.ps-method::after{content:"";position:absolute;right:20px;top:50%;width:8px;height:8px;border-top:1.5px solid var(--ps-color-text-muted);border-right:1.5px solid var(--ps-color-text-muted);transform:translateY(-50%) rotate(45deg);transition:transform .15s cubic-bezier(.2,.4,0,1)}
.ps-method:hover{background:var(--ps-color-surface-hover);border-color:var(--ps-color-border-strong)}
.ps-method:hover::after{transform:translate(2px,-50%) rotate(45deg)}
.ps-method-icon{width:40px;height:40px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:13px;background:var(--ps-color-primary-soft);color:var(--ps-color-primary-text)}
.ps-method-text{display:block;min-width:0}
.ps-method strong{display:block;font-size:14px;line-height:20px;font-weight:600;color:var(--ps-color-text)}
.ps-method-text>span{display:block;margin-top:2px;font-size:12px;line-height:16px;color:var(--ps-color-text-muted)}
.ps-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 20px;font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;user-select:none;border-radius:var(--ps-border-radius-button);border:1px solid transparent;text-decoration:none;transition:background-color .15s cubic-bezier(.2,.4,0,1),color .15s cubic-bezier(.2,.4,0,1),transform .15s cubic-bezier(.2,.4,0,1)}
.ps-btn:active:not(:disabled){transform:scale(.98)}
.ps-primary{width:100%;min-height:48px;padding:0 24px;background:var(--ps-color-primary);color:var(--ps-color-on-primary)}
.ps-primary:hover{background:var(--ps-color-primary-hover)}
.ps-secondary{background:transparent;color:var(--ps-color-text);border-color:var(--ps-color-border-strong)}
.ps-secondary:hover{background:var(--ps-color-surface-hover)}
.ps-tonal{background:var(--ps-color-primary-soft);color:var(--ps-color-primary-text)}
.ps-tonal:hover{background:color-mix(in srgb,var(--ps-color-primary-text) 20%,var(--ps-color-background))}
.ps-small{min-height:32px;padding:0 14px;font-size:12px;line-height:16px;gap:6px}
.ps-link{min-height:40px;padding:0;background:none;border:0;color:var(--ps-color-primary-text);font-size:14px;font-weight:500;cursor:pointer;text-decoration:none;align-self:flex-start}
.ps-link:hover{text-decoration:underline;text-underline-offset:2px}
.ps-btn:disabled,.ps-method:disabled{opacity:.5;cursor:not-allowed}
.ps-checkout :focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--ps-color-primary-text) 30%,transparent)}
.ps-field{display:flex;flex-direction:column;gap:6px}
.ps-field label{font-size:13px;line-height:18px;font-weight:500;color:var(--ps-color-text)}
.ps-field label small{font-weight:400;color:var(--ps-color-text-muted);font-size:12px}
.ps-input{width:100%;min-height:48px;padding:0 16px;font-size:14px;line-height:20px;color:var(--ps-color-text);background:var(--ps-color-background);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius);appearance:none;transition:border-color .15s cubic-bezier(.2,.4,0,1)}
.ps-input::placeholder{color:var(--ps-color-text-subtle)}
.ps-input:hover{border-color:var(--ps-color-border-strong)}
.ps-checkout .ps-input:focus,.ps-checkout .ps-input:focus-visible{outline:none;box-shadow:none;border-color:var(--ps-color-primary-text)}
.ps-input[aria-invalid=true],.ps-input[aria-invalid=true]:hover,.ps-input[aria-invalid=true]:focus{border-color:var(--ps-color-danger)}
.ps-help{font-size:12px;line-height:16px;color:var(--ps-color-text-muted)}
.ps-error{font-size:12px;line-height:16px;color:var(--ps-color-danger)}
.ps-alert{padding:12px 14px;font-size:13px;line-height:18px;color:var(--ps-color-danger);background:var(--ps-color-danger-soft);border-radius:13px}
.ps-note{padding:12px 14px;font-size:13px;line-height:18px;color:var(--ps-color-text-body);background:var(--ps-color-primary-soft);border-radius:13px}
.ps-chains{display:flex;flex-wrap:wrap;gap:8px}
.ps-chain{min-height:40px;padding:0 16px;font-size:13px;font-weight:500;cursor:pointer;color:var(--ps-color-text);background:var(--ps-color-background);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-button);transition:background-color .15s cubic-bezier(.2,.4,0,1),border-color .15s cubic-bezier(.2,.4,0,1)}
.ps-chain:hover{background:var(--ps-color-surface-hover)}
.ps-chain[aria-checked=true]{border-color:var(--ps-color-primary-text);background:var(--ps-color-primary-soft);color:var(--ps-color-primary-text)}
.ps-well{padding:16px;background:var(--ps-color-surface);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-surface)}
.ps-mono{font-family:var(--ps-font-family-mono);font-size:13px;line-height:20px;color:var(--ps-color-text);overflow-wrap:anywhere;user-select:all}
.ps-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ps-qr{display:flex;flex-direction:column;align-items:center;gap:8px}
.ps-qr svg{width:176px;height:176px;background:#fff;border-radius:13px;padding:10px;border:1px solid var(--ps-color-border)}
.ps-details summary{min-height:40px;display:flex;align-items:center;cursor:pointer;font-size:13px;font-weight:500;color:var(--ps-color-primary-text)}
.ps-details dl{margin:4px 0 12px;display:grid;grid-template-columns:auto 1fr;gap:8px 12px;font-size:13px;line-height:18px}
.ps-details dt{color:var(--ps-color-text-muted)}
.ps-details dd{margin:0;overflow-wrap:anywhere;color:var(--ps-color-text)}
.ps-result{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:16px 0 8px}
.ps-badge{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
.ps-ok{color:var(--ps-color-success);background:var(--ps-color-success-soft)}
.ps-bad{color:var(--ps-color-danger);background:var(--ps-color-danger-soft)}
.ps-neutral{color:var(--ps-color-text-muted);background:var(--ps-color-surface-hover)}
.ps-spinner{width:20px;height:20px;flex:none;border-radius:50%;border:2px solid var(--ps-color-border);border-top-color:var(--ps-color-primary-text);animation:ps-spin .8s linear infinite}
.ps-skeleton{height:14px;border-radius:7px;background:var(--ps-color-surface-hover)}
.ps-footer{display:flex;justify-content:center;margin-top:24px;padding-top:16px;border-top:1px solid var(--ps-color-border)}
.ps-powered{display:inline-flex;align-items:center;gap:7px;padding:4px 8px;min-height:24px;font-size:12px;line-height:16px;color:var(--ps-color-text-subtle);text-decoration:none;border-radius:8px}
.ps-powered .ps-wordmark{display:block;flex:none;color:var(--ps-color-text-muted);transition:color .15s cubic-bezier(.2,.4,0,1)}
.ps-powered:hover .ps-wordmark{color:var(--ps-color-primary-text)}
.ps-mark{display:block;flex:none}
.ps-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@keyframes ps-spin{to{transform:rotate(360deg)}}
@media (max-width:420px){.ps-checkout{padding:20px 16px}}
@media (prefers-reduced-motion:reduce){.ps-spinner{animation:none}.ps-btn,.ps-back,.ps-method,.ps-method::after,.ps-chain,.ps-input{transition:none}.ps-btn:active:not(:disabled){transform:none}}
`
