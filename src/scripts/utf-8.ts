const boxes = [...document.querySelectorAll<HTMLInputElement>("#bits input")];
const hexes = [...document.querySelectorAll<HTMLOutputElement>(".hex")];
const decoded = document.getElementById("decoded")!;
const decoder = new TextDecoder("utf-8");

function update(): void {
  const bytes = new Uint8Array(256);

  boxes.forEach((box, i) => {
    const bit = box.checked ? 1 : 0;
    bytes[Math.floor(i / 8)] |= bit << (7 - (i % 8));
  });

  hexes.forEach((hex, i) => (hex.textContent = bytes[i].toString(16).padStart(2, "0").toUpperCase()));
  decoded.textContent = decoder.decode(bytes);
}

boxes.forEach((box) => box.addEventListener("change", update));
update();
