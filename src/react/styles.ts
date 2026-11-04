// The checkout's one stylesheet. Every class starts ps- and
// sits under .ps-checkout, whose CSS variables carry the theme, so the
// merchant's CSS cannot leak in and ours cannot leak out. Borders, not shadows.
// It goes in one <style> tag, which takes the merchant's nonce under a strict CSP.
export const CSS = `
.ps-checkout{all:initial;display:block;box-sizing:border-box;position:relative;width:100%;max-width:440px;margin:0 auto;padding:24px;background:var(--ps-color-background);color:var(--ps-color-text-body);font-family:var(--ps-font-family);font-size:15px;line-height:1.5;border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-surface);overflow:hidden;-webkit-font-smoothing:antialiased}
.ps-checkout *,.ps-checkout *::before,.ps-checkout *::after{box-sizing:border-box;font-family:inherit}
.ps-checkout h2,.ps-checkout h3,.ps-checkout p{margin:0}
.ps-ribbon{position:absolute;top:0;right:0;padding:3px 10px;font-size:12px;font-weight:600;color:var(--ps-color-warning);background:var(--ps-color-surface);border-bottom-left-radius:var(--ps-border-radius)}
.ps-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.ps-logo{width:40px;height:40px;flex:none;border-radius:var(--ps-border-radius);border:1px solid var(--ps-color-border);background:var(--ps-color-surface);object-fit:contain;display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--ps-color-text)}
.ps-merchant{flex:1;min-width:0}
.ps-merchant-name{font-weight:600;color:var(--ps-color-text);overflow-wrap:anywhere}
.ps-desc{font-size:13px;color:var(--ps-color-text-muted);overflow-wrap:anywhere}
.ps-amount{font-family:var(--ps-font-family-mono);font-size:28px;font-weight:600;color:var(--ps-color-text);letter-spacing:-.01em;overflow-wrap:anywhere}
.ps-token{font-size:15px;color:var(--ps-color-text-muted);margin-left:6px}
.ps-label{font-size:13px;color:var(--ps-color-text-muted)}
.ps-stack{display:flex;flex-direction:column;gap:12px}
.ps-title{font-size:17px;font-weight:600;color:var(--ps-color-text);outline:none}
.ps-muted{color:var(--ps-color-text-muted);font-size:13px}
.ps-methods{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.ps-method{display:block;width:100%;min-height:56px;padding:12px 14px;text-align:left;cursor:pointer;color:var(--ps-color-text);background:var(--ps-color-background);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-surface)}
.ps-method:hover{background:var(--ps-color-surface)}
.ps-method strong{display:block;font-weight:600}
.ps-method span{display:block;font-size:13px;color:var(--ps-color-text-muted)}
.ps-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;font-size:15px;font-weight:600;cursor:pointer;border-radius:var(--ps-border-radius);border:1px solid transparent;text-decoration:none}
.ps-primary{width:100%;background:var(--ps-color-primary);color:var(--ps-color-on-primary)}
.ps-primary:hover{background:var(--ps-color-primary-hover)}
.ps-secondary{background:var(--ps-color-background);color:var(--ps-color-text);border-color:var(--ps-color-border)}
.ps-secondary:hover{background:var(--ps-color-surface)}
.ps-link{min-height:44px;padding:0;background:none;border:0;color:var(--ps-color-primary-text);font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.ps-btn:disabled,.ps-method:disabled{opacity:.6;cursor:not-allowed}
.ps-checkout :focus-visible{outline:2px solid var(--ps-color-primary-text);outline-offset:2px}
.ps-field{display:flex;flex-direction:column;gap:6px}
.ps-field label{font-size:14px;font-weight:500;color:var(--ps-color-text)}
.ps-field label small{font-weight:400;color:var(--ps-color-text-muted);font-size:13px}
.ps-input{width:100%;min-height:44px;padding:8px 12px;font-size:15px;color:var(--ps-color-text);background:var(--ps-color-background);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius)}
.ps-input[aria-invalid=true]{border-color:var(--ps-color-danger)}
.ps-help{font-size:13px;color:var(--ps-color-text-muted)}
.ps-error{font-size:13px;color:var(--ps-color-danger)}
.ps-alert{padding:10px 12px;font-size:14px;color:var(--ps-color-danger);border:1px solid var(--ps-color-danger);border-radius:var(--ps-border-radius)}
.ps-note{padding:10px 12px;font-size:13px;color:var(--ps-color-text-body);background:var(--ps-color-primary-soft);border-radius:var(--ps-border-radius)}
.ps-chains{display:flex;flex-wrap:wrap;gap:8px}
.ps-chain{min-height:44px;padding:0 14px;cursor:pointer;color:var(--ps-color-text);background:var(--ps-color-background);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius)}
.ps-chain[aria-checked=true]{border-color:var(--ps-color-primary);background:var(--ps-color-primary-soft)}
.ps-well{padding:14px;background:var(--ps-color-surface);border:1px solid var(--ps-color-border);border-radius:var(--ps-border-radius-surface)}
.ps-mono{font-family:var(--ps-font-family-mono);font-size:14px;color:var(--ps-color-text);overflow-wrap:anywhere;user-select:all}
.ps-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ps-qr{display:flex;flex-direction:column;align-items:center;gap:8px}
.ps-qr svg{width:168px;height:168px;background:#fff;border-radius:var(--ps-border-radius);padding:8px}
.ps-details summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:14px;color:var(--ps-color-primary-text)}
.ps-details dl{margin:4px 0 0;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13px}
.ps-details dt{color:var(--ps-color-text-muted)}
.ps-details dd{margin:0;overflow-wrap:anywhere}
.ps-result{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:12px 0}
.ps-badge{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
.ps-ok{color:var(--ps-color-success);border:2px solid var(--ps-color-success)}
.ps-bad{color:var(--ps-color-danger);border:2px solid var(--ps-color-danger)}
.ps-neutral{color:var(--ps-color-text-muted);border:2px solid var(--ps-color-border)}
.ps-spinner{width:20px;height:20px;border-radius:50%;border:2px solid var(--ps-color-border);border-top-color:var(--ps-color-primary);animation:ps-spin .8s linear infinite}
.ps-skeleton{height:14px;border-radius:6px;background:var(--ps-color-surface)}
.ps-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@keyframes ps-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ps-spinner{animation:none}}
`
