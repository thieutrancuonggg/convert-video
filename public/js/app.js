document.addEventListener('DOMContentLoaded', function () {
  initUploadZone();
  initProductNameField();
  initUploadForm();
});

// ─── Upload zone: click + drag & drop ────────────────────────────────────────
function initUploadZone() {
  var zone  = document.getElementById('upload-zone');
  var input = document.getElementById('video-file');
  var info  = document.getElementById('file-info');

  if (!zone || !input) return;

  zone.addEventListener('click', function () { input.click(); });

  zone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') input.click();
  });

  zone.addEventListener('dragover', function (e) {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', function () {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      alert('Chỉ chấp nhận file .mp4');
      return;
    }
    // Assign dropped file to the input element via DataTransfer
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    } catch (_) {
      // DataTransfer not supported in some older browsers — ignore
    }
    showFileInfo(file, info);
  });

  input.addEventListener('change', function () {
    if (input.files[0]) showFileInfo(input.files[0], info);
  });
}

function showFileInfo(file, infoEl) {
  if (!infoEl) return;
  var mb = (file.size / 1024 / 1024).toFixed(1);
  infoEl.textContent = file.name + ' (' + mb + ' MB)';
  infoEl.style.display = 'flex';
}

// ─── Product name field: char counter ────────────────────────────────────────
function initProductNameField() {
  var input   = document.getElementById('product-name');
  var counter = document.getElementById('char-count');
  if (!input || !counter) return;

  function update() {
    var len = input.value.length;
    counter.textContent = len + '/80';
    counter.classList.toggle('near-limit', len >= 60 && len < 80);
    counter.classList.toggle('at-limit',   len >= 80);
  }

  input.addEventListener('input', update);
  update();
}

// ─── Upload form: loading state on submit ─────────────────────────────────────
function initUploadForm() {
  var form    = document.getElementById('upload-form');
  var input   = document.getElementById('video-file');
  var btnText = document.getElementById('btn-text');
  var btnLoad = document.getElementById('btn-loading');
  var btn     = document.getElementById('submit-btn');

  if (!form) return;

  form.addEventListener('submit', function (e) {
    if (!input || !input.files[0]) {
      e.preventDefault();
      alert('Vui lòng chọn file MP4 trước khi upload.');
      return;
    }
    var nameInput = document.getElementById('product-name');
    if (nameInput && !nameInput.value.trim()) {
      e.preventDefault();
      nameInput.focus();
      alert('Vui lòng nhập tên sản phẩm.');
      return;
    }
    // Show loading state
    if (btn)     btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoad) btnLoad.style.display = 'inline';
  });
}
