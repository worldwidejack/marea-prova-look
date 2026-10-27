#!/bin/bash
# Fa generare immagini a Codex da un elenco di lavori, N alla volta in parallelo.
# Ogni riga del file: nome|rif1.png,rif2.png|prompt   (percorsi dei riferimenti relativi alla cartella del file)
# Il risultato va in <cartella del file>/<nome>.png. Le righe con un PNG già fatto si saltano.
# Uso: strumenti/codex_img.sh concept/asset/lavori.txt [solo nome1 nome2…]
LAVORI="$1"; shift; SOLO="$*"
cd "$(dirname "$LAVORI")"; mkdir -p log
PARALLELI=${PARALLELI:-4}
while IFS='|' read -r NOME RIF TESTO; do
  [ -z "$NOME" ] && continue; [[ "$NOME" == \#* ]] && continue
  if [ -n "$SOLO" ] && [[ " $SOLO " != *" $NOME "* ]]; then continue; fi
  [ -f "$NOME.png" ] && continue
  while [ "$(jobs -rp | wc -l)" -ge "$PARALLELI" ]; do sleep 3; done
  {
    echo "$TESTO"
    echo
    echo "Generate ONE image, then copy the generated PNG into the current folder named ${NOME}.png. Do NOT create or edit any _STATO.md, _MEMORIA or diary file, do not use git: this is a sub-task of a Claude session that updates the state itself. Reply only with the file name."
  } > "log/prompt_${NOME}.txt"
  ARG=(); [ -n "$RIF" ] && ARG=(--image "$RIF")
  codex exec --skip-git-repo-check -s workspace-write -C "$PWD" "${ARG[@]}" - < "log/prompt_${NOME}.txt" > "log/codex_${NOME}.log" 2>&1 &
done < "$(basename "$LAVORI")"
wait
ls -1 *.png 2>/dev/null
