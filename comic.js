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
    { pattern: /scene4\/8\.png$/i,  audio: specialAudio.revenge },
    { pattern: /scene4\/9\.png$/i,  audio: specialAudio.flyingPigeon },
    { pattern: /scene4\/12\.png$/i, audio: specialAudio.warContinues },
    { pattern: /scene5\/3\.png$/i,  audio: specialAudio.idea },
    { pattern: /scene5\/7\.png$/i,  audio: specialAudio.wow },
    { pattern: /scene5\/8\.png$/i,  audio: specialAudio.happyPigeons },
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
    { src: 'scene1/1part.png', scene: 1 },
    { src: 'scene1/2part.png', scene: 1 },
    { src: 'scene1/3part.png', scene: 1 },
    { src: 'scene1/4part.png', scene: 1 },
    { src: 'scene1/5part.png', scene: 1 },
    { src: 'scene2/1.PNG', scene: 2 },
    { src: 'scene2/2.PNG', scene: 2 },
    { src: 'scene2/3.PNG', scene: 2 },
    { src: 'scene2/4.PNG', scene: 2 },
    { src: 'scene3/1.PNG', scene: 3 },
    { src: 'scene3/2.PNG', scene: 3 },
    { src: 'scene3/3.PNG', scene: 3 },
    { src: 'scene3/4.PNG', scene: 3 },
    { src: 'scene3/5.PNG', scene: 3 },
    { src: 'scene3/6.PNG', scene: 3 },
    { src: 'scene3/7.PNG', scene: 3 },
    { src: 'scene3/8.PNG', scene: 3 },
    { src: 'scene3/9.PNG', scene: 3 },
    { src: 'scene3/10.PNG', scene: 3 },
  ];

  const REVENGE_SCENES = [
    { src: 'scene4/1.PNG', scene: 4 },
    { src: 'scene4/2.PNG', scene: 4 },
    { src: 'scene4/3.PNG', scene: 4 },
    { src: 'scene4/4.PNG', scene: 4 },
    { src: 'scene4/5.PNG', scene: 4 },
    { src: 'scene4/6.PNG', scene: 4 },
    { src: 'scene4/7.PNG', scene: 4 },
    { src: 'scene4/8.PNG', scene: 4 },
    { src: 'scene4/9.PNG', scene: 4 },
    { src: 'scene4/10.PNG', scene: 4 },
    { src: 'scene4/11.PNG', scene: 5 },
    { src: 'scene4/12.PNG', scene: 5 },
    { src: 'scene4/13.PNG', scene: 5 },
  ];

  const FRIENDS_SCENES = [
    { src: 'scene5/1.PNG', scene: 5 },
    { src: 'scene5/2.PNG', scene: 5 },
    { src: 'scene5/3.PNG', scene: 5 },
    { src: 'scene5/4.PNG', scene: 5 },
    { src: 'scene5/5.PNG', scene: 5 },
    { src: 'scene5/6.PNG', scene: 5 },
    { src: 'scene5/7.PNG', scene: 5 },
    { src: 'scene5/8.PNG', scene: 6 },
    { src: 'scene5/9.PNG', scene: 6 },
    { src: 'scene5/10.PNG', scene: 6 },
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
    decisionRow.setAttribute('role', 'group');
    decisionRow.setAttribute('aria-label', 'Choose ending');

    const revengeBtn = document.createElement('button');
    revengeBtn.className = 'decision-btn revenge';
    revengeBtn.type = 'button';
    revengeBtn.textContent = 'Take Revenge';
    revengeBtn.addEventListener('click', () => startBranch('revenge'));

    const friendsBtn = document.createElement('button');
    friendsBtn.className = 'decision-btn friends';
    friendsBtn.type = 'button';
    friendsBtn.textContent = 'Make Friends';
    friendsBtn.addEventListener('click', () => startBranch('friends'));

    decisionRow.appendChild(revengeBtn);
    decisionRow.appendChild(friendsBtn);
    if (viewer) viewer.appendChild(decisionRow);
    return decisionRow;
  }

  function updateDecisionOverlay() {
    const shouldShow = images[index] && /scene3\/10\.PNG$/i.test(images[index].src);
    const el = ensureDecisionUI();
    el.style.display = shouldShow ? 'flex' : 'none';
    if (nextBtn) nextBtn.hidden = !!shouldShow;

    if (shouldShow) {
      if (REVENGE_SCENES.length && !branchPreload.revenge) {
        branchPreload.revenge = preloadImages(REVENGE_SCENES);
      }
      if (FRIENDS_SCENES.length && !branchPreload.friends) {
        branchPreload.friends = preloadImages(FRIENDS_SCENES);
      }
      if (!branchPrewarmDone.revenge && branchPreload.revenge) {
        predecodeFirstN(branchPreload.revenge, 3);
        branchPrewarmDone.revenge = true;
      }
      if (!branchPrewarmDone.friends && branchPreload.friends) {
        predecodeFirstN(branchPreload.friends, 3);
        branchPrewarmDone.friends = true;
      }
    }
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

  // --- Crossfade rendering ---
  // New image fades in ON TOP of the old (which stays fully opaque).
  // Once the new image is fully visible, the old one is removed.
  // This prevents any white flash since there's always a fully opaque image visible.

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
    if (isAnimating) {
      queuedDelta += delta;
      return;
    }

    const max = images.length - 1;
    const next = Math.min(max, Math.max(0, index + delta));
    if (next === index) return;

    const now = performance.now();
    const fastTap = (now - lastNavTs) < 220;
    lastNavTs = now;

    const isSceneChange = images[index].scene !== images[next].scene;

    if (fastTap) {
      performFastNavigation(next);
      return;
    }

    isAnimating = true;

    if (isSceneChange) {
      flipTransition(next, delta).finally(() => {
        isAnimating = false;
        prewarmNeighbors();
        drainQueued();
      });
    } else {
      index = next;
      render().finally(() => {
        isAnimating = false;
        prewarmNeighbors();
        drainQueued();
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

  function startBranch(which) {
    const list = which === 'revenge' ? REVENGE_SCENES : FRIENDS_SCENES;
    if (!list || list.length === 0) return;

    currentBranch = which;

    let branchCache = branchPreload[which];
    if (!branchCache || branchCache.length !== list.length) {
      branchCache = preloadImages(list);
      branchPreload[which] = branchCache;
    }

    isAnimating = true;

    Promise.all(branchCache.map(decodeImage)).then(() => {
      const currentImg = album.querySelector('img');
      if (currentImg) currentImg.style.opacity = '0';
      playFlipSound();
      setTimeout(() => {
        if (currentImg && currentImg.parentNode) currentImg.remove();
        images = list.slice();
        cache = branchCache;
        index = 0;
        render({ isFirstRender: true }).finally(() => {
          isAnimating = false;
          prewarmNeighbors();
          updateNavState();
          updateDecisionOverlay();
        });
      }, 200);
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
