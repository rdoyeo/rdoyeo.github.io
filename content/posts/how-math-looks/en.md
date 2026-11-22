---
title: How math looks on this blog
date: 2026-11-20
tags: [mathematics, meta]
---

Every post here starts as a plain Markdown file. Math goes between dollar signs: `$f : A \to B$` renders inline as $f : A \to B$, and a block between double dollar signs gets a line of its own. This post is a short tour of what that looks like.

## Definitions and theorems

Definitions, theorems, lemmas and proofs each get their own box, written as a fenced block in the Markdown.

:::definition
A map $f : A \to B$ is *surjective* if for every $b \in B$ there is some $a \in A$ with $f(a) = b$.
:::

:::theorem[Cantor]
For any set $A$, there is no surjection $A \to \mathcal{P}(A)$.
:::

:::proof
Suppose $f : A \to \mathcal{P}(A)$ is surjective, and let $D = \{ a \in A : a \notin f(a) \}$. Then $D = f(d)$ for some $d \in A$, and $d \in D$ exactly when $d \notin D$, a contradiction.
:::

## Display math

Longer formulas sit centered on their own line.

$$
|\mathcal{P}(A)| = 2^{|A|} > |A|
$$

Multi-line derivations use `aligned`:

$$
\begin{aligned}
(a+b)^2 &= (a+b)(a+b) \\
        &= a^2 + 2ab + b^2
\end{aligned}
$$

## Commutative diagrams

Diagrams written with `\begin{CD}` render as real diagrams, so a factorization like $g = \alpha \circ f \circ \Delta$ reads at a glance.

$$
\begin{CD}
A \times A @>f>> Y \\
@A{\Delta}AA @VV{\alpha}V \\
A @>g>> Y
\end{CD}
$$

For anything `CD` can't draw (diagonal arrows, curves, TikZ pictures), export an SVG and put it in a figure. Click it to see it larger:

![A diagram exported from TikZ](/writing/example-diagram.svg "Figure 1. Exported from TikZ as SVG.")

## What I type

```
:::theorem[Cantor]
For any set $A$, there is no surjection $A \to \mathcal{P}(A)$.
:::

$$
\begin{CD}
A \times A @>f>> Y \\
@A{\Delta}AA @VV{\alpha}V \\
A @>g>> Y
\end{CD}
$$
```

Footnotes work too.[^1]

[^1]: Like this one.
