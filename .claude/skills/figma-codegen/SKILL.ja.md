---
name: figma-codegen
description: Figma Design URLから、再現性、レスポンシブ、再利用可能なコンポーネント、永続的なFigma-to-code mapを備えたプロジェクト固有のUIを生成・更新する。Figmaのframe、screen、component、variant、asset、UIで使うtoken、responsive layout、interaction、motion、shaderの実装、Figmaとコードの比較、Figma変更後の再同期に使用する。単独のFigma Variable棚卸しやexportには使用せず、figma-variable-extractを使用する。公式Figma MCPの証拠を優先し、必要時のみ公式REST APIをread-onlyで補完し、デザイン値や挙動を推測せずfail closedにする。
---

# Figmaデザインを実装する

Figmaを見た目の正、リポジトリを実装の正、プロジェクト所有のmapを同期の正として扱う。手順は短く保ち、詳細な証拠と検証記録は本文ではなく付属resourceへ置く。

## 前提条件を確認する

1. このSkillのdirectoryと、書き込み可能な対象repositoryを特定する。
2. `node`が`PATH`にあることを必須とし、承認なしにruntimeを導入・置換しない。
3. `node <skill-directory>/scripts/validate-figma-code-map.mjs --check-runtime`を実行し、Node.js 22以上の場合だけ続行する。
4. 書き込み前にrepository instructionsを読み、実際のstack、routing、component ownership、styling、token、asset、test、runtime declarationを調査する。

## Workflowに従う

### 1. 実装契約を確定し承認を得る

read-onlyの調査で次を確定する。

- URLで正確に選択されたFigma node ID、実装root ID、名前
- page、layout、component、sectionのどれにするか
- 出力pathとsymbol
- hostのpathとsymbol、または明示されたstandalone出力
- 再利用範囲とstateまたはdataの所有者
- 必須state、対応幅、正確なviewport、breakpointの根拠
- 子孫の全Figma Component、Component Set、Instanceを`reuse-existing`または`create-component`のどちらにするか

明示されたuser scope、確認済みrepository rule、確認済みCode Connectまたは既存code contract、最後にboundaryだけを決めるFigma構造の順で判断する。Figma URL、layer名、一般的な慣習、repository上の単一の候補は承認ではない。Figma構造だけでは配置や再利用範囲は確定しない。

全項目を含む簡潔な提案を提示し、最初のcode、asset、dependency、設定の書き込み前に明示的な承認を求める。証拠上の候補が複数なら、先に対象を絞る質問をする。承認を`user-decision`として記録する。沈黙や無関係な過去の承認は承認として扱わない。

### 2. 対象範囲の証拠を取得する

[figma-evidence.md](references/figma-evidence.md)を最後まで読む。接続中の公式Figma MCPの現在のread toolを確認し、metadata、design context、正確なnodeのscreenshot、VariablesとStyles、Code Connect、asset、annotation、motion、shader、library referenceを取得する。大きなrootは安定したchildへ分割して網羅性を証明する。tool callの成功だけで未切り詰めの結果とは判断しない。

特定したMCP不足だけを、現在の公式REST documentationと最小権限のread-only endpointで補完する。tokenを永続化せず、FigmaやCode Connectを変更しない。Variableは今回のUIの証拠にだけ使用し、単独の棚卸しやexportは`figma-variable-extract`へ委譲する。

正確なID、値、unit、binding、alias、mode、component key、property、asset、取得元を保持する。component keyを合成せず、正確なkeyまたは`node:<node-id>` fallbackを使う。sourceが競合するときは候補を保存し、project rule、明示的user decision、approved deviationのいずれかだけで解決する。それ以外はgapとして止める。

### 3. Mapを作成または読み込む

[mapping-contract.md](references/mapping-contract.md)を最後まで読む。[figma-code-map.template.json](assets/figma-code-map.template.json)を承認済みのproject locationへcopyする。既存規約がなければ`.figma/figma-code-map.json`を使う。再同期では既存mapをvalidateして読み込む。

実装開始前に、承認済み契約、予定code target、取得した証拠、component inventory、必須state、scenario、具体的gapを記録する。作業中のmapはcompletion validationに失敗してよいが、推測値を完了済みとして記録してはいけない。

全coverage categoryをmapするか、具体的なnot-applicable理由を記録する。全子孫Figma componentを1つのimport済みproject componentへbindし、全rootでcomponent keyごとに1つのcanonical bindingを保つ。付属semantic adapterはJS/TSのdeclaration、import、JSX useがcommentではなく実行codeに存在することを検査する。別言語では完了を主張する前に決定的なrepository固有adapterを追加し、単純な文字列検査へ弱めない。

同じcomponent keyのinstanceが反復される場合は、順序を1つの`identity-hierarchy` evidence配列として記録し、実行code内のliteral順序へmapする。assetは影響するroot IDとともにtop-level `assets`配列だけへ記録し、asset evidenceを重複させない。

### 4. 証拠から実装する

repository architectureに従い、確認済みcomponent、token、asset、utility、testを再利用する。Component Setはvariantを持つ1つのtyped APIとして扱う。Figma componentをinline化せず、互換な既存componentを再作成せず、不要なlibraryや別のstyling systemを追加しない。

route、fragment link、event handler、label、motion、dataを作り出さない。interactive behaviorはFigma prototype、repository contract、user decisionのいずれかで確定する。確定できなければproject標準のrequired inputとして外部から受け取るか、停止して質問する。対応先のない`#features`のようなplaceholderは、JS/TSのdata objectへ格納して後からJSXへ渡す場合も禁止する。

実assetをFigmaの証拠からexportする。iconの描き直し、imageの代用、期限付きURLの埋め込みをしない。`img`、`video`、`svg`、`canvas`の外側にあるpositioningやclipping boxは、計測で同等と証明するまで保持する。

### 5. Responsiveを実装する

複数の正確なFigma viewport、確認済みproject responsive rule、明示的user decisionのいずれかを使用する。endpoint frameだけではbreakpointは確定しない。中間値、一般的なdevice width、推測したrearrangementを選ばない。

rootごとに必須stateを棚卸しする。各stateのscenarioを追加し、各rootについて対応最小幅、最大幅、範囲内の各根拠付きbreakpointの1px下、breakpointそのものを追加する。挙動が変わる場合だけstateとwidthの追加組み合わせを作り、不要な直積を作らない。

### 6. 検証して完了する

repositoryのformat、static analysis、test、build、関連interaction checkを実行する。各scenarioで実際のbrowser viewport、device pixel ratio、document width、root bounds、typedなexpectedとactualを計測する。viewportやoverflowの測定だけでなく、rendered layoutまたはcontent behaviorを少なくとも1つassertする。overflow、viewport不一致、state不足、rootの範囲外を失敗にする。

各Figma-backed scenarioで、同一寸法の最新の正確なnode画像とroot-onlyの実装画像を比較する。

```bash
node <skill-directory>/scripts/compare-images.mjs \
  --source <temporary-figma-node.png> \
  --implementation <temporary-implementation.png>
```

mapには寸法、hash、root bounds、viewport計測、metric値だけを残す。screenshotは使い捨てにする。crop、resize、固定thresholdの緩和、目視判断によるpass化をしない。

全検証を現在のmapped codeとassetへ結び付ける。

```bash
node <skill-directory>/scripts/validate-figma-code-map.mjs --print-digest .figma/figma-code-map.json
node <skill-directory>/scripts/validate-figma-code-map.mjs .figma/figma-code-map.json
```

出力されたdigestと現在の検証時刻を保存してからvalidatorを実行する。実装変更やhandoff後は計測、比較、repository check、digestを再実行する。gapや失敗が残る間は完了としない。

`source.revision.type`が`evidence-sha256`なら`--print-source-digest`で生成し、screenshot hashを流用しない。実装digestを出力する前に、renderingへ影響するpackage manifest、lockfile、設定を`verification.implementation.additionalPaths`へ追加する。

### 7. Figma変更後に再同期する

現在のmapをvalidateし、同じrootとcategoryを再取得し、node ID、component key、property、VariableまたはStyle ID、asset reference、canonical code targetで比較する。差分をFigma-only、code-only、concurrent、approved deviationに分類する。互換な対象pathだけを更新し、無関係な変更を保持し、共通digestと検証を更新し、意図が競合するときは停止する。

## 推測禁止を強制する

正確なFigma property、Variable、Style、asset、annotation、prototype、確認済みCode Connect、対象repositoryまたはplatform contract、明示的user decisionのいずれかからだけ値や挙動を出力する。screenshotはrendering検証用であり数値styleの根拠ではない。生成sample codeは調査対象であり、そのまま貼り付けるcodeではない。

## 報告する

実装したrootとcode target、配置、再利用または作成したcomponent binding、stateと対応幅、証拠取得元とREST補完、map path、repository check、visual metric、responsive計測、変換、deviation、残存gapを報告する。scopeがcomplete、partial、blockedのどれかを明記する。tokenやprivate payloadを公開しない。

## 付属resource

- [figma-evidence.md](references/figma-evidence.md): 証拠範囲、競合処理、REST境界。
- [mapping-contract.md](references/mapping-contract.md): schema、component binding、共通digest、completion gate。
- [figma-code-map.template.json](assets/figma-code-map.template.json): 最小のschema version 1 starter。
- `scripts/validate-figma-code-map.mjs`: runtime、schema、semantic、asset、scenario、digest gate。
- `scripts/compare-images.mjs`: 固定thresholdの決定的PNG comparator。
