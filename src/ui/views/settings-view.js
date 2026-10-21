import { backupService } from '../../services/backup-service.js';
import { settingsRepository } from '../../db/repositories/settings-repository.js';
import { showToast } from '../components/toast.js';

export async function renderSettingsView(container, queryParams, router) {
  let pendingImportData = null;
  let importSummary = null;

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Configurações & Backup</h1>
          <p class="page-subtitle">Exporte sua coleção, restaure backups e gerencie preferências</p>
        </div>
      </div>

      <!-- Export Section -->
      <div class="card-panel" style="margin-bottom: var(--space-6);">
        <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-2);">Exportar Coleção</h2>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
          Baixe um arquivo JSON contendo todos os seus baralhos, cartões, histórico de revisões e imagens anexadas.
        </p>
        <button id="btn-export-backup" class="btn btn-primary">Baixar Backup Completo (.json)</button>
      </div>

      <!-- Import Section -->
      <div class="card-panel" style="margin-bottom: var(--space-6);">
        <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-2);">Restaurar Backup</h2>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
          Selecione um arquivo de backup previamente exportado para restaurar ou mesclar com sua coleção existente.
        </p>
        
        <input type="file" id="backup-file-input" accept=".json" style="margin-bottom: var(--space-4); font-size: var(--font-size-sm);">

        <div id="import-preview-area" style="display: none; background: var(--color-bg); padding: var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-4);">
          <h3 style="font-size: var(--font-size-base); font-weight: 600; margin-bottom: var(--space-2);">Resumo do Arquivo</h3>
          <ul id="import-stats-list" style="font-size: var(--font-size-sm); margin-left: var(--space-4); margin-bottom: var(--space-4);"></ul>

          <div class="form-group">
            <label class="form-label">Estratégia de Importação:</label>
            <label style="display: block; margin-bottom: var(--space-2); cursor: pointer;">
              <input type="radio" name="import-strategy" value="merge" checked>
              <strong>Mesclar:</strong> Adiciona novos registros preservando os dados já existentes no navegador.
            </label>
            <label style="display: block; cursor: pointer;">
              <input type="radio" name="import-strategy" value="replace">
              <strong>Substituir:</strong> Apaga os dados locais atuais e restaura exatamente a coleção do arquivo.
            </label>
          </div>

          <div style="display: flex; gap: var(--space-3); margin-top: var(--space-4);">
            <button id="btn-cancel-import" class="btn btn-secondary">Cancelar</button>
            <button id="btn-confirm-import" class="btn btn-primary">Confirmar Importação</button>
          </div>
        </div>
      </div>

      <!-- Info about storage -->
      <div class="card-panel">
        <h2 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-2);">Privacidade e Armazenamento</h2>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); line-height: 1.6;">
          Todos os seus dados de estudo são armazenados <strong>localmente no seu dispositivo</strong> através da tecnologia IndexedDB. 
          Nenhum dado pessoal ou cartão é enviado para servidores externos. Lembre-se de realizar backups regulares antes de limpar os dados de navegação do seu dispositivo.
        </p>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const btnExport = container.querySelector('#btn-export-backup');
    btnExport.addEventListener('click', async () => {
      try {
        btnExport.disabled = true;
        btnExport.textContent = 'Gerando arquivo de backup...';

        const backup = await backupService.exportBackup();
        const jsonStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = `flashcards-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Backup gerado e download iniciado!', 'success');
      } catch (err) {
        showToast('Erro ao exportar backup: ' + err.message, 'error');
      } finally {
        btnExport.disabled = false;
        btnExport.textContent = 'Baixar Backup Completo (.json)';
      }
    });

    const fileInput = container.querySelector('#backup-file-input');
    const previewArea = container.querySelector('#import-preview-area');
    const statsList = container.querySelector('#import-stats-list');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          const validation = backupService.validateBackup(parsed);

          if (!validation.isValid) {
            showToast('Arquivo inválido: ' + validation.error, 'error');
            fileInput.value = '';
            previewArea.style.display = 'none';
            return;
          }

          pendingImportData = parsed;
          importSummary = validation.summary;

          statsList.innerHTML = `
            <li>Baralhos encontrados: <strong>${importSummary.decksCount}</strong></li>
            <li>Cartões encontrados: <strong>${importSummary.cardsCount}</strong></li>
            <li>Histórico de revisões: <strong>${importSummary.reviewsCount}</strong></li>
            <li>Imagens anexadas: <strong>${importSummary.imagesCount}</strong></li>
            <li>Data do backup: <strong>${new Date(importSummary.exportedAt).toLocaleString('pt-BR')}</strong></li>
          `;

          previewArea.style.display = 'block';
        } catch (err) {
          showToast('Erro ao ler JSON: ' + err.message, 'error');
          fileInput.value = '';
          previewArea.style.display = 'none';
        }
      };
      reader.readAsText(file);
    });

    container.querySelector('#btn-cancel-import').addEventListener('click', () => {
      pendingImportData = null;
      fileInput.value = '';
      previewArea.style.display = 'none';
    });

    container.querySelector('#btn-confirm-import').addEventListener('click', async () => {
      if (!pendingImportData) return;
      const strategy = container.querySelector('input[name="import-strategy"]:checked').value;

      if (strategy === 'replace') {
        const confirmed = confirm('ATENÇÃO: A substituição apagará todos os seus cartões e baralhos atuais para carregar o arquivo. Tem certeza?');
        if (!confirmed) return;
      }

      try {
        await backupService.importBackup(pendingImportData, strategy);
        showToast('Backup restaurado com sucesso!', 'success');
        pendingImportData = null;
        fileInput.value = '';
        previewArea.style.display = 'none';
      } catch (err) {
        showToast('Falha na restauração: ' + err.message, 'error');
      }
    });
  }

  render();

  return {
    destroy: () => {}
  };
}
