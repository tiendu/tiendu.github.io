// UNFOLD: shared geometric icons. SVGs are purely decorative;
// native text and accessible labels remain the source of meaning.
const paths={
  'local':'<path d="M4 7h16v11H4z"/><path d="M8 11h5m-2.5-2.5v5M17 11h2m-1 4h0"/>',
  'create':'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 8v8m-4-4h8"/>',
  'join':'<path d="M3 12h12m-4-4 4 4-4 4"/><path d="M13 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6"/>',
  'back':'<path d="M11 5 4 12l7 7M4 12h16"/>',
  'module':'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10"/>',
  'deploy':'<path d="M9 4h6v6H9zM3 10h6v6H3zM9 10h6v6H9zM15 10h6v6h-6zM9 16h6v6H9z"/>',
  'super':'<path d="M4 9h5v5H4zM9 9h5v5H9zM14 9h5v5h-5zM9 14h5v5H9z"/><path d="m19 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
  'reclaim':'<path d="M4 11a8 8 0 0 1 13-6l3 3M20 3v5h-5M20 13a8 8 0 0 1-13 6l-3-3M4 21v-5h5"/><path d="M9 9h6v6H9z"/>',
  'refold':'<path d="M4 9 12 4l8 5v9l-8 4-8-4zM4 9l8 5 8-5m-8 5v8"/><path d="m3 4 3-1-1 4"/>',
  'hub':'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v5M12 18v5M1 12h5m12 0h5"/>',
  'goal':'<path d="m12 2 3.5 6.5L22 12l-6.5 3.5L12 22l-3.5-6.5L2 12l6.5-3.5z"/><circle cx="12" cy="12" r="2.5"/>',
  'crate':'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="m7 7 10 10M17 7 7 17"/>',
  'wall':'<path d="M3 4h18v16H3zM3 10h18M3 16h18M10 4v6m5 0v6m-5 0v4"/>',
  'gate':'<path d="M3 3v18M21 3v18M7 5v14m5-14v14m5-14v14"/><path d="M4 12h16"/>',
  'gate-open':'<path d="M3 3v18M21 3v18M7 7l5 5-5 5m10-10-5 5 5 5"/>',
};
export function gameIcon(name,className='game-symbol'){
  if(!Object.hasOwn(paths,name))throw new RangeError('Unknown game icon');
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
