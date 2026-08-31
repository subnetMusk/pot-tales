/// <reference types="vite/client" />

// Dichiara i tipi che Vite inietta a compilazione, `import.meta.env` compreso.
// Senza, ogni lettura di una variabile di ambiente e' un errore di tipo: la
// compilazione non se ne accorge, perche' non verifica i tipi, quindi il
// difetto compare solo nel controllo separato.
