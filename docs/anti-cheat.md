# Anti-cheat — NEON INVADERS

## A premissa

**O score nunca pode ser confiado vindo do cliente.** O jogo roda inteiro no
navegador do jogador: o console está a duas teclas de distância, o bundle é
legível e qualquer número que o cliente calcula, o cliente pode inventar.
Nenhuma ofuscação muda isso.

O que dá para fazer — e o que está feito — é responder a uma pergunta mais
modesta e verificável: **esta partida poderia ter acontecido?** Cada regra abaixo
é um limite físico do jogo, não uma heurística de "bom demais para ser humano".
Essa distinção é a linha editorial deste documento: *recusar um jogador honesto
custa mais do que deixar passar um trapaceiro medíocre*.

Implementação: `src/services/validation/plausibility.ts` (regras puras) e
`src/services/validation/limits.ts` (os tetos). Rodam nos dois lados: dentro do
`LocalScoreService`, quando o ranking é do aparelho, e dentro da Edge Function
`runs-submit`, quando há servidor.

**É o mesmo código, não uma reimplementação.** `npm run supabase:sync` copia os
três módulos para `supabase/functions/_shared/validation/` reescrevendo só os
specifiers de import — o Deno não resolve os aliases do Vite e exige extensão
`.ts`. `tests/edgeShared.test.ts` roda o mesmo gerador em memória e falha se a
cópia em disco divergir. Mesmo arranjo do `runLimits.test.ts` logo abaixo:
duplicação deliberada, divergência impossível.

---

## 1. Como os tetos são calculados

Uma partida que chegou à fase _N_ com duração _D_ tem um teto de pontos:

```
teto = Σ (fase 1..N) cap(fase) + ufos(D)·300 + capsulas(D)·500 + minions(D)·8
```

com `cap(fase) = 990 (formação) + splitters da fase + pontos do chefão`.

| Origem                | Teto por fase | De onde vem                                       |
| --------------------- | ------------- | ------------------------------------------------- |
| Formação              | 990           | 11×30 + 22×20 + 22×10, a formação inteira         |
| Splitters             | 352           | 22 aliens tipo B × 2 filhos × 8 pts (fases 3–5)   |
| Nave-mãe              | 1000…3000     | tabela de `config/bosses.ts`                      |
| UFO                   | 300 cada      | bônus máximo, um a cada 20 s no mínimo            |
| Cápsula no nível máx. | 500 cada      | cooldown global de 10 s entre drops               |
| Minions               | 8 cada        | 2 a cada 8 s, só nas fases que invocam            |

Os termos que dependem do tempo (UFO, cápsulas, minions) são calculados a partir
dos intervalos **mínimos** de aparição: é sempre o cenário mais generoso
possível para o jogador.

### A duplicação deliberada

`limits.ts` **copia** números que moram em `src/game/config/`. Não é descuido: o
validador precisa rodar no servidor, onde o bundle do jogo não existe, e a
fronteira entre os agentes proíbe `src/services/` de importar `src/game/`.

O risco dessa cópia é ela envelhecer em silêncio — alguém rebalanceia a fase 4 e
o ranking passa a recusar partida honesta. Por isso existe
`tests/runLimits.test.ts`: é o único arquivo do projeto que importa os dois
lados, e ele falha no instante em que divergirem.

---

## 2. As regras, em ordem de aplicação

Da mais barata para a mais cara; a primeira que falha é a resposta.

| `reason`              | Regra                                                                             |
| --------------------- | --------------------------------------------------------------------------------- |
| `MALFORMED`           | Todo contador precisa ser inteiro ≥ 0. Fracionário, negativo ou `NaN` é payload adulterado. |
| `INVALID_LEVEL`       | Fase em 1..5. Vitória exige as 5 naves-mãe. Derrubar o chefão da fase _N_ já leva à _N+1_, logo quem parou na fase _N_ tem no máximo _N−1_ chefões. |
| `DURATION_TOO_SHORT`  | 6 s por fase completa. Vem das animações que nenhuma habilidade encurta: entrada da nave-mãe (1,6 s) + pausa pós-derrota (2,2 s) + espera antes do chefão (1,4 s). |
| `IMPOSSIBLE_KILLS`    | Não se mata mais alien do que a formação tem, mais UFO do que cabe no tempo, nem mais cápsula do que o cooldown de 10 s permite. |
| `SHOTS_TOO_FEW`       | Um projétil acerta no máximo um alvo, e o núcleo do chefão tira 1 de HP por acerto. Cada abate declarado tem custo mínimo em tiros: `abates + Σ HP dos chefões`. |
| `SHOTS_TOO_MANY`      | Cadência máxima é RAPID nível 5 (100 ms) com MULTI nível 4 (5 projéteis) = 50 projéteis/s, com 15% de folga para arredondamento de frame. |
| `SCORE_ABOVE_CAP`     | Score acima do teto da seção 1.                                                    |
| `SCORE_MISMATCH`      | O score tem de cair na faixa dos abates declarados: `[Σ pontos fixos + UFOs×50, Σ pontos fixos + UFOs×300 + cápsulas×500]`. Pega tanto inflar o score quanto zerar os contadores para escapar dos outros testes. |

Fora do validador puro, no serviço:

| `reason`             | Regra                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| `UNKNOWN_RUN_TOKEN`  | Sem `startRun` não há submissão, e um token vale uma vez só. No servidor o consumo é atômico (`update … where used_at is null`): ler-depois-escrever deixaria duas submissões simultâneas do mesmo token passarem as duas. |
| `DURATION_MISMATCH`  | A duração declarada não pode passar do tempo de parede desde o `startRun` (5 s de folga). O contrário é rotina: o relógio do Phaser **para** quando a aba perde o foco, então o tempo declarado é sempre ≤ o real. |
| `RATE_LIMITED`       | Uma submissão a cada 3 s no cliente; por hora e por conta, no servidor (ver `api-contract.md` §5). |

### Por que `SCORE_MISMATCH` fecha o cerco

As regras se prendem umas às outras. Inflar o score sozinho cai em
`SCORE_ABOVE_CAP`. Inflar score e abates juntos cai em `IMPOSSIBLE_KILLS`.
Inflar score, abates e tiros cai em `SHOTS_TOO_MANY` ou em `DURATION_TOO_SHORT`.
Zerar os contadores para fugir de todas cai em `SCORE_MISMATCH`. A saída que
resta é forjar uma partida internamente coerente — que é, essencialmente,
descrever uma partida que alguém poderia ter jogado.

---

## 3. O que este desenho **não** resolve

Escrito aqui para que ninguém confunda o escopo depois:

- **Bot que joga de verdade.** Um script que dirige o input do jogo produz uma
  run perfeitamente plausível, porque ela é plausível. Defesa possível no futuro:
  exigir um traço de input amostrado e procurar regularidade sobre-humana.
- **Replay determinístico.** A defesa forte de verdade é o cliente mandar a
  semente e a sequência de inputs, e o servidor **re-simular** a partida. Isso
  exige que o core do jogo seja determinístico e rode em Node — possível
  (`src/game/core/` já é lógica pura sem Phaser), mas é um milestone inteiro.
- **Conta descartável.** Convidado é grátis e ilimitado por desenho, porque o
  jogo tem de ser jogável sem cadastro. Um ranking global sério acaba precisando
  de ranking separado para convidados ou de e-mail verificado no topo da tabela.

---

## 4. Regras de ouro para quem mexer nisto depois

1. **Toda regra nova precisa ser um limite físico, com fonte no código do jogo.**
   Se você não consegue apontar a constante de `config/` que a justifica, ela não
   entra.
2. **Todo teto é generoso.** Na dúvida entre 1,1× e 0,9× do limite teórico,
   escolha 1,1×.
3. **Recusa não quebra a partida.** O jogador vê a tela de fim de jogo normal; o
   que ele perde é a linha no ranking. Nunca transforme recusa em erro na cara
   de quem jogou.
4. **Todo `reason` novo entra no `api-contract.md` e ganha teste.**
