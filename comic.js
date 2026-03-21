(() => {
  'use strict';

  const album = document.querySelector('.album');
  const viewer = document.querySelector('.comic-viewer');
  const prevBtn = document.querySelector('.nav-btn.prev');
  const nextBtn = document.querySelector('.nav-btn.next');
  const yearEl = document.getElementById('year');
  let isAnimating = false;
  let lastNavTs = 0;
  let queuedDelta = 0;

  const preloadOverlay = document.getElementById('preloadOverlay');
  const preloadBar = document.getElementById('preloadBar');
  const comicViewer = document.getElementById('comicViewer');
  const kbdHint = document.getElementById('kbdHint');
  let branchAdded = false; 
  let mainStoryLength = 3; 

  let currentBranch = 'main';

  // --- Flip sound pool ---
  const flipSounds = Array.from({ length: 3 }, () => {
    const a = new Audio('sound/flip_page.mp3');
    a.preload = 'auto';
    a.volume = 0.6;
    return a;
  });
  let flipSoundIndex = 0;

  function playFlipSound() {
    const a = flipSounds[flipSoundIndex];
    flipSoundIndex = (flipSoundIndex + 1) % flipSounds.length;
    a.playbackRate = 0.98 + Math.random() * 0.06;
    try { a.currentTime = 0; } catch (_) {}
    a.play().catch(() => {});
  }

  // --- Special audio cues ---
  const specialAudio = {
    revenge:       new Audio('sound/revenge.mp3'),
    flyingPigeon:  new Audio('sound/flying_pigeon.mp3'),
    idea:          new Audio('sound/idea.mp3'),
    wow:           new Audio('sound/wow_sound.mp3'),
    warContinues:  new Audio('sound/war_continues.mp3'),
    happyPigeons:  new Audio('sound/happy_pigeons.mp3'),
  };

  Object.values(specialAudio).forEach((a) => {
    a.preload = 'auto';
    a.volume = 0.85;
  });

const AUDIO_CUES = [
    // Scene 2: Pigeon getting "shooed"
    { pattern: /scene2\/1\.png$/i,  audio: specialAudio.flyingPigeon },
    
    // Revenge Branch (Scene 4)
    { pattern: /scene4\/1\.png$/i,  audio: specialAudio.revenge },
    { pattern: /scene4\/2\.png$/i,  audio: specialAudio.warContinues },
    
    // Friends Branch (Scene 5)
    { pattern: /scene5\/1\.png$/i,  audio: specialAudio.idea },
    { pattern: /scene5\/2\.png$/i,  audio: specialAudio.happyPigeons }
  ];

  function maybePlaySpecialAudio() {
    const src = images[index] && images[index].src || '';
    for (const cue of AUDIO_CUES) {
      if (cue.pattern.test(src)) {
        try { cue.audio.currentTime = 0; } catch (_) {}
        cue.audio.play().catch(() => {});
        return;
      }
    }
  }

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- Image data ---
  let images = [
    { src: 'scene1/1.png', scene: 1 },
    { src: 'scene2/1.png', scene: 2 },
    { src: 'scene3/1.png', scene: 3 },
  ];

  const REVENGE_SCENES = [
    { src: 'scene4/1.png', scene: 4 },
    { src: 'scene4/2.png', scene: 5 },
  ];

  const FRIENDS_SCENES = [
    { src: 'scene5/1.png', scene: 5 },
    { src: 'scene5/2.png', scene: 6 },
  ];

  // --- Preloading ---
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve(img);
      };
      img.onload = done;
      img.onerror = done;
      img.src = src;
      if (img.complete && img.naturalWidth > 0) done();
    });
  }

  function decodeImage(img) {
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => {});
    }
    return Promise.resolve();
  }

  function buildCacheWithProgress(list, onProgress) {
    let loaded = 0;
    return Promise.all(
      list.map((item) =>
        loadImage(item.src).then((img) => {
          return decodeImage(img).then(() => {
            loaded++;
            if (onProgress) onProgress(loaded, list.length);
            return img;
          });
        })
      )
    );
  }

  let cache = [];
  const branchPreload = { revenge: null, friends: null };
  const branchPrewarmDone = { revenge: false, friends: false };

  function preloadImages(list) {
    return list.map((item) => {
      const img = new Image();
      img.src = item.src;
      return img;
    });
  }

  function predecodeFirstN(imagesList, count = 3) {
    if (!imagesList || !imagesList.length) return;
    imagesList.slice(0, Math.min(count, imagesList.length)).forEach((im) => {
      if (im) decodeImage(im);
    });
  }

  let index = 0;

  // --- Decision UI ---
  let decisionRow = null;

function ensureDecisionUI() {
    if (decisionRow) return decisionRow;
    decisionRow = document.createElement('div');
    decisionRow.className = 'decision-row';

    const revengeBtn = document.createElement('button');
    revengeBtn.className = 'decision-btn revenge';
    revengeBtn.textContent = 'Take Revenge';
    revengeBtn.onclick = () => startBranch('revenge');

    const friendsBtn = document.createElement('button');
    friendsBtn.className = 'decision-btn friends';
    friendsBtn.textContent = 'Make Friends';
    friendsBtn.onclick = () => startBranch('friends');

    const resetBtn = document.createElement('button');
    resetBtn.className = 'decision-btn reset';
    resetBtn.textContent = 'Start Over';
    resetBtn.style.display = 'none'; 
    resetBtn.onclick = () => restartStory();

    decisionRow.append(revengeBtn, friendsBtn, resetBtn);
    if (viewer) viewer.appendChild(decisionRow);
    return decisionRow;
}


function updateDecisionOverlay() {
    const isAtCouncil = (index === mainStoryLength - 1);
    const isAtTheEnd = (index === images.length - 1 && branchAdded);
    
    const el = ensureDecisionUI();
    const revBtn = el.querySelector('.revenge');
    const friBtn = el.querySelector('.friends');
    const resBtn = el.querySelector('.reset');

    el.style.display = (isAtCouncil || isAtTheEnd) ? 'flex' : 'none';

    if (isAtCouncil) {
      revBtn.style.display = 'block';
      friBtn.style.display = 'block';
      resBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.visibility = 'hidden';
    } else if (isAtTheEnd) {

      revBtn.style.display = 'none';
      friBtn.style.display = 'none';
      resBtn.style.display = 'block';
      if (nextBtn) nextBtn.style.visibility = 'hidden';
    } else {

      if (nextBtn) {
        nextBtn.style.visibility = 'visible';
        nextBtn.disabled = false;
      }
    }
    
    if (prevBtn) prevBtn.hidden = (index === 0);
}


function updateNavState() {
    if (prevBtn) prevBtn.hidden = index === 0;
    if (nextBtn) nextBtn.disabled = index === images.length - 1;
  }

  function prewarmNeighbors() {
    [index + 1, index + 2, index - 1].forEach((i) => {
      if (cache[i]) decodeImage(cache[i]);
    });
  }


  function crossfade(newImg, duration) {
    return new Promise((resolve) => {
      const oldImgs = album.querySelectorAll('img');

      newImg.style.opacity = '0';
      newImg.style.position = 'relative';
      newImg.style.zIndex = '2';
      album.appendChild(newImg);

      // Force the browser to commit opacity:0 before we transition
      void newImg.offsetWidth;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newImg.style.opacity = '1';

          setTimeout(() => {
            // New image is fully opaque — safe to remove old ones
            oldImgs.forEach((old) => {
              if (old !== newImg && old.parentNode) old.remove();
            });
            newImg.style.position = '';
            newImg.style.zIndex = '';
            resolve();
          }, duration + 50);
        });
      });
    });
  }

  function render(options = {}) {
    const { skipFade = false, isFirstRender = false } = options;
    const total = images.length;
    const sceneNum = images[index].scene;
    const alt = `Scene ${sceneNum} — Panel ${index + 1} of ${total}`;
    const img = cache[index];

    album.setAttribute('aria-label', alt);
    img.alt = alt;

    updateNavState();
    updateDecisionOverlay();

    if (isFirstRender || skipFade) {
      const old = album.querySelector('img');
      if (old && old !== img) old.remove();
      img.style.opacity = '1';
      if (!img.parentNode) album.appendChild(img);
      maybePlaySpecialAudio();
      return Promise.resolve();
    }

    return decodeImage(img).then(() => {
      return crossfade(img, 300);
    }).then(() => {
      maybePlaySpecialAudio();
    });
  }

  // --- Scene-change flip ---
  function flipTransition(nextIndex, delta) {
    return new Promise((resolve) => {
      const flipClass = delta > 0 ? 'flip-forward' : 'flip-back';
      const oldImg = album.querySelector('img');
      const nextImg = cache[nextIndex];

      decodeImage(nextImg).then(() => {
        playFlipSound();
        album.classList.add(flipClass);

        setTimeout(() => {
          index = nextIndex;
          const total = images.length;
          const sceneNum = images[index].scene;
          const alt = `Scene ${sceneNum} — Panel ${index + 1} of ${total}`;
          nextImg.alt = alt;
          nextImg.style.opacity = '1';
          nextImg.style.position = 'relative';
          nextImg.style.zIndex = '2';

          // Add new image on top, keep old underneath
          album.appendChild(nextImg);
          album.setAttribute('aria-label', alt);

          requestAnimationFrame(() => {
            album.classList.remove('flip-forward', 'flip-back');

            requestAnimationFrame(() => {
              // Now new image is painted — safe to remove old
              if (oldImg && oldImg.parentNode) oldImg.remove();
              nextImg.style.position = '';
              nextImg.style.zIndex = '';
              maybePlaySpecialAudio();
              updateNavState();
              updateDecisionOverlay();
              resolve();
            });
          });
        }, 250);
      });
    });
  }

  // --- Navigation ---
function go(delta) {
    if (isAnimating) return;

    if (delta > 0 && index === images.length - 1 && branchAdded) return;

    const next = index + delta;
    if (next < 0 || next >= images.length) return;

    isAnimating = true;
    const isSceneChange = images[index].scene !== images[next].scene;

    if (isSceneChange) {
      flipTransition(next, delta).finally(() => {
        isAnimating = false;
        updateDecisionOverlay();
      });
    } else {
      index = next;
      render().finally(() => {
        isAnimating = false;
        updateDecisionOverlay();
      });
    }
  }
  function performFastNavigation(nextIndex) {
    isAnimating = true;
    album.classList.remove('flip-forward', 'flip-back');
    album.classList.add('no-anim');

    const oldImgs = album.querySelectorAll('img');
    const nextImg = cache[nextIndex];
    index = nextIndex;

    nextImg.style.opacity = '1';
    nextImg.style.position = 'relative';
    nextImg.style.zIndex = '2';
    album.appendChild(nextImg);

    requestAnimationFrame(() => {
      oldImgs.forEach((old) => {
        if (old !== nextImg && old.parentNode) old.remove();
      });
      nextImg.style.position = '';
      nextImg.style.zIndex = '';
      album.classList.remove('no-anim');
      album.setAttribute('aria-label', `Scene ${images[index].scene} — Panel ${index + 1} of ${images.length}`);
      isAnimating = false;
      maybePlaySpecialAudio();
      prewarmNeighbors();
      updateNavState();
      updateDecisionOverlay();
      drainQueued();
    });
  }

  function drainQueued() {
    if (!queuedDelta) return;
    const d = queuedDelta;
    queuedDelta = 0;
    const next = Math.min(images.length - 1, Math.max(0, index + d));
    if (next === index) return;
    performFastNavigation(next);
  }

function restartStory() {
    if (isAnimating) return;
    isAnimating = true;

    branchAdded = false;
    images.length = mainStoryLength;
    cache.length = mainStoryLength;

    playFlipSound();
    album.classList.add('flip-back');

    setTimeout(() => {
      index = 0;
      render({ skipFade: true }).finally(() => {
        album.classList.remove('flip-back');
        isAnimating = false;
        updateNavState();
        updateDecisionOverlay();
      });
    }, 250);
}

function startBranch(which) {
    const list = which === 'revenge' ? REVENGE_SCENES : FRIENDS_SCENES;
    const branchCache = branchPreload[which];

    if (!list || !branchCache) return;

    if (branchAdded) {
      images.length = mainStoryLength; 
      cache.length = mainStoryLength;
    }

    images.push(...list);
    cache.push(...branchCache);
    branchAdded = true;

    isAnimating = true;

    const nextIndex = mainStoryLength; 
    
    decodeImage(cache[nextIndex]).then(() => {
      playFlipSound();
      album.classList.add('flip-forward');

      setTimeout(() => {
        index = nextIndex;
        render({ skipFade: true }).finally(() => {
          album.classList.remove('flip-forward');
          isAnimating = false;
          updateNavState();
        });
      }, 250);
    });
  }

  // --- Event listeners ---
  if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => go(1));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  // Touch swipe
  let touchStartX = 0;
  let touchStartY = 0;

  if (album) {
    album.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    album.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        go(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  // --- Mobile menu ---
  const mobileToggle = document.querySelector('.mobile-toggle');
  const siteNav = document.querySelector('.site-nav');

  if (mobileToggle && siteNav) {
    mobileToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // --- Boot: preload all images, decode them, then reveal ---
  const allScenes = [...images, ...REVENGE_SCENES, ...FRIENDS_SCENES];
  const mainCount = images.length;
  const revengeCount = REVENGE_SCENES.length;

  buildCacheWithProgress(allScenes, (loaded, total) => {
    if (preloadBar) preloadBar.style.width = `${(loaded / total) * 100}%`;
  }).then((loadedImages) => {
    cache = loadedImages.slice(0, mainCount);
    branchPreload.revenge = loadedImages.slice(mainCount, mainCount + revengeCount);
    branchPreload.friends = loadedImages.slice(mainCount + revengeCount);
    branchPrewarmDone.revenge = true;
    branchPrewarmDone.friends = true;

    if (preloadOverlay) preloadOverlay.classList.add('done');
    if (comicViewer) comicViewer.style.display = '';
    if (kbdHint) kbdHint.style.display = '';

    setTimeout(() => {
      if (preloadOverlay) preloadOverlay.style.display = 'none';
    }, 400);

    render({ isFirstRender: true }).then(() => {
      prewarmNeighbors();
    });
  });
})();
