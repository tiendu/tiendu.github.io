// Set this to the public HTTPS address of your deployed UNFOLD room server.
// Local development defaults to http://<current-host>:8787 automatically.
// Example: window.UNFOLD_ROOM_API = 'https://rooms.example.com';
window.UNFOLD_ROOM_API = document.querySelector('meta[name="unfold-room-api"]')?.content || '';
