const $ = (q) => document.querySelector(q);

    function suggestOutName(name) {
      const base = String(name || 'output').replace(/\.[Pp][Dd][Ff]$/, '');
      return base + '_pdfa.pdf';
    }

    // --- UI Enhancements ---
    const uploadArea = $("#upload-area");
    const fileInput = $("#file");
    const fileInfo = $("#file-info");

    uploadArea.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
    });

    uploadArea.addEventListener('drop', (e) => {
      fileInput.files = e.dataTransfer.files;
      handleFileChange({ target: fileInput });
    });
    
    fileInput.addEventListener('change', (e) => handleFileChange(e));

    function handleFileChange(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;

      fileInfo.textContent = `Επιλεγμένο αρχείο: ${f.name}`;
      fileInfo.style.display = 'block';
      
      const s = suggestOutName(f.name);
      const inp = $("#fname");
      if (!inp.value) inp.value = s;
      else inp.placeholder = s;
    }
    // --- End of UI Enhancements ---

    async function initGS() {
      if (typeof Ghostscript === 'function') return await Ghostscript();
      if (typeof GS === 'function') return await GS();
      if (typeof Module === 'function') return await Module();
      if (typeof Module === 'object' && Module) {
        if (Module.FS && Module.calledRun) return Module;
        await new Promise(res => {
          const ready = () => res();
          if (Module.onRuntimeInitialized) {
            const prev = Module.onRuntimeInitialized;
            Module.onRuntimeInitialized = () => { prev(); ready(); };
          } else {
            Module.onRuntimeInitialized = ready;
          }
        });
        return Module;
      }
      throw new Error('Δεν βρέθηκε το Ghostscript WASM module. Βεβαιωθείτε ότι φορτώνει σωστά το assets/gs.js.');
    }

    async function convert() {
      const f = $("#file").files[0];
      if (!f) { alert('Παρακαλώ επιλέξτε ένα αρχείο PDF.'); return; }
      
      const flavor = $("#flavor").value;
      const suggested = suggestOutName(f.name || 'output');
      const outName = ($("#fname").value || suggested).replace(/\s+/g, '-');
      
      $("#btn").disabled = true;
      $("#dl").style.display = 'none';
      $("#loader-container").style.display = 'block';

      try {
        const gs = await initGS();

        gs.print = (t) => console.log(String(t || "").trim());
        gs.printErr = (t) => console.error(String(t || "").trim());

        const inName = 'in.pdf';
        const iccName = 'sRGB.icc';
        const outNameFS = 'out.pdf';

        const buf = new Uint8Array(await f.arrayBuffer());
        gs.FS.writeFile(inName, buf);

        try {
          const BASE = location.pathname.replace(/[^\/]*$/, '');
          const icc = await fetch(`${BASE}assets/sRGB.icc`);
          if (!icc.ok) throw new Error('Αποτυχία φόρτωσης ICC profile');
          const iccBuf = new Uint8Array(await icc.arrayBuffer());
          gs.FS.writeFile(iccName, iccBuf);
        } catch (e) {
          console.warn('Δεν βρέθηκε το sRGB.icc στο /assets/. Η μετατροπή μπορεί να αποτύχει.');
        }

        const OI_NAME = 'sRGB IEC61966-2.1';
        const args = [
          '-dBATCH', '-dNOPAUSE',
          `-dPDFA=${flavor}`,
          '-sDEVICE=pdfwrite',
          '-dUseCIEColor',
          '-sProcessColorModel=DeviceRGB',
          '-sColorConversionStrategy=UseDeviceIndependentColor',
          '-dEmbedAllFonts=true',
          '-dSubsetFonts=true',
          '-dCompressFonts=true',
          '-sPDFACompatibilityPolicy=1',
          `-sPDFAOutputIntent=${OI_NAME}`,
          `-sOutputICCProfile=${iccName}`,
          `-sOutputFile=${outNameFS}`,
          inName
        ];

        gs.callMain(args);
        
        const out = gs.FS.readFile(outNameFS);
        const blob = new Blob([out], { type: 'application/pdf' });
        
        if (window.__prevURL) URL.revokeObjectURL(window.__prevURL);
        const url = URL.createObjectURL(blob);
        window.__prevURL = url;
        
        const a = $("#dl");
        a.href = url;
        a.download = outName;
        a.style.display = 'block';
        a.textContent = `⬇️ Λήψη του ${outName}`;

      } catch (e) {
        alert('Η μετατροπή απέτυχε. ' + (e && e.message ? e.message : ''));
      } finally {
        $("#btn").disabled = false;
        $("#loader-container").style.display = 'none';
      }
    }

    $("#btn").addEventListener('click', () => {
      convert().catch(err => { 
        alert('Προέκυψε ένα σφάλμα: ' + err.message); 
        $("#btn").disabled = false; 
        $("#loader-container").style.display = 'none';
      });
    });

    if ('serviceWorker' in navigator) {
      const BASE = location.pathname.replace(/[^\/]*$/, '');
      navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE })
        .then(registration => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) console.log('Νέο περιεχόμενο είναι διαθέσιμο. Παρακαλώ ανανεώστε τη σελίδα.');
                else console.log('Το περιεχόμενο έχει αποθηκευτεί στην cache για χρήση offline.');
              }
            };
          };
        }).catch(() => {});
    }