#!/usr/bin/env bash
set -euo pipefail

format_markdown() {
  awk '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    function flush_group(    i, text, width, pad, has_pipe, has_v) {
      if (group_count == 0) return

      width = 0
      has_pipe = 0
      has_v = 0

      for (i = 1; i <= group_count; i++) {
        text = group[i]

        if (block_indent != "" && \
            substr(text, 1, length(block_indent)) == block_indent) {
          text = substr(text, length(block_indent) + 1)
        }

        clean[i] = trim(text)
        if (clean[i] == "|") has_pipe = 1
        if (clean[i] == "v") has_v = 1
        if (length(clean[i]) > width) width = length(clean[i])
      }

      if (has_pipe && has_v) {
        for (i = 1; i <= group_count; i++) {
          pad = int((width - length(clean[i])) / 2)
          printf "%s%*s%s\n", block_indent, pad, "", clean[i]
        }
      } else {
        for (i = 1; i <= group_count; i++) print group[i]
      }

      delete group
      delete clean
      group_count = 0
    }

    /^[[:space:]]*```+text[[:space:]]*$/ {
      match($0, /^[[:space:]]*/)
      block_indent = substr($0, 1, RLENGTH)
      in_text_block = 1
      print
      next
    }

    in_text_block && /^[[:space:]]*```+[[:space:]]*$/ {
      flush_group()
      in_text_block = 0
      block_indent = ""
      print
      next
    }

    in_text_block {
      if ($0 ~ /^[[:space:]]*$/) {
        flush_group()
        print
      } else {
        group[++group_count] = $0
      }
      next
    }

    { print }

    END { flush_group() }
  ' "$@"
}

in_place=false

if [[ ${1-} == "-i" || ${1-} == "--in-place" ]]; then
  in_place=true
  shift
fi

if "$in_place"; then
  if (($# == 0)); then
    printf 'error: -i requires at least one file\n' >&2
    exit 2
  fi

  for file in "$@"; do
    tmp=$(mktemp "${file}.XXXXXX")
    trap 'rm -f "$tmp"' EXIT

    format_markdown "$file" > "$tmp"
    cat "$tmp" > "$file"

    rm -f "$tmp"
    trap - EXIT
  done
else
  format_markdown "${1:-/dev/stdin}"
fi
