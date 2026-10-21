# [NOME DO APP] — Aplicativo Pessoal de Flashcards com Repetição Espaçada

Aplicativo web estático e offline-first de flashcards para memorização ativa e repetição espaçada (Spaced Repetition System - SRS), desenvolvido para rodar no navegador ou ser publicado gratuitamente no GitHub Pages sem dependência de servidores ou banco de dados externo.

---

## 🌟 Principais Recursos

- **Repetição Espaçada Determinística:** Implementação dos algoritmos com 4 níveis de avaliação: *De novo (`again`)*, *Difícil (`hard`)*, *Bom (`good`)* e *Fácil (`easy`)*.
- **Persistência Totalmente Local (IndexedDB):** Nenhuma informação sai do seu dispositivo. Seus dados persistem entre recarregamentos e sessões.
- **Baralhos e Etiquetas:** Crie baralhos e categorize cartões com etiquetas personalizadas (`#tag`).
- **Exclusão Transacional e Segura:** Ao excluir baralhos com cartões, escolha explicitamente entre excluir em cascata ou mover os cartões para outro baralho.
- **Suporte a Código e Markdown Seguro:** Apresentação clara de trechos de código com destaque e Markdown protegido contra ataques XSS.
- **Anexo de Imagens Locais:** Suporte para até 5 MB por imagem (armazenadas diretamente em Blob no IndexedDB sem converter cartões em strings pesadas).
- **Atalhos de Teclado:** Na sessão de estudo, pressione `Espaço` ou `Enter` para mostrar a resposta, e teclas `1`, `2`, `3` e `4` para avaliar.
- **Backup e Restauração Confiável:** Exporte seu acervo completo em JSON estruturado e importe quando quiser através de estratégias de **Mesclagem** (merge) ou **Substituição** (replace).
- **PWA & Offline:** Suporte a Progressive Web App com Service Worker e cache estático.
- **Deploy Pronto para GitHub Pages:** Caminhos de assets relativos (`./`) e workflow automatizado com GitHub Actions.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 Semântico & CSS Vanilla** (design system modular, tokens CSS e responsividade para celular e desktop)
- **JavaScript Moderno (ES Modules nativos)**
- **IndexedDB** nativo do navegador para armazenamento relacional e binário
- **Vite** para desenvolvimento e empacotamento estático otimizado
- **Vitest** e `fake-indexeddb` para testes unitários e de integração contínuos

---

## 🚀 Instalação e Desenvolvimento Local

### Pré-requisitos
- Node.js (v18+) e NPM.

### Passos
1. Clone o repositório ou acesse a pasta do projeto:
   ```bash
   cd anki
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor local de desenvolvimento:
   ```bash
   npm run dev
   ```
   Abra no seu navegador o endereço fornecido (ex: `http://localhost:5173/`).

4. Executar os testes automatizados:
   ```bash
   npm test
   ```

5. Gerar a build de produção estática:
   ```bash
   npm run build
   ```
   Os arquivos finais prontos para hospedagem estática serão gerados na pasta `dist/`.

---

## 🧠 Algoritmo de Repetição Espaçada (SRS)

O algoritmo é puro, determinístico e calcula os intervalos a partir da avaliação:

| Avaliação | 1ª Revisão | Revisões Posteriores | Efeito no Cartão |
| :--- | :--- | :--- | :--- |
| **De novo (`again`)** | 0 dias | 0 dias | Zera repetições, incrementa lapsos e recoloca o cartão na fila da sessão atual |
| **Difícil (`hard`)** | 1 dia | `anterior × 1,2` | Incrementa repetições |
| **Bom (`good`)** | 1 dia (2ª = 3d) | `anterior × 2,0` | Incrementa repetições |
| **Fácil (`easy`)** | 4 dias | `anterior × 2,5` | Incrementa repetições |

---

## 💾 Estrutura do Backup JSON

O backup exportado possui a seguinte estrutura padronizada e validada:
```json
{
  "format": "anki-web-backup",
  "version": "1.0",
  "exportedAt": "2026-10-21T12:00:00.000Z",
  "decks": [...],
  "cards": [...],
  "reviews": [...],
  "settings": {...},
  "images": [
    {
      "id": "uuid",
      "mimeType": "image/png",
      "sizeBytes": 1024,
      "dataUrl": "data:image/png;base64,..."
    }
  ]
}
```

---

## 🌐 Publicação no GitHub Pages

O projeto já conta com o workflow `.github/workflows/deploy.yml`:
1. No seu repositório no GitHub, acesse **Settings** > **Pages**.
2. Na seção **Build and deployment**, selecione **Source: GitHub Actions**.
3. Realize um push na branch `main` ou `master`. O GitHub Actions executará os testes, criará a build e publicará a aplicação automaticamente.
