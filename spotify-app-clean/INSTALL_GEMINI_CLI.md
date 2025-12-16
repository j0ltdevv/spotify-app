# Installation de Gemini CLI

Ce document explique comment installer et configurer l'interface de ligne de commande (CLI) de Gemini, qui peut être utile pour interagir avec des modèles d'IA générative.

## 1. Prérequis

Assure-toi d'avoir les éléments suivants installés sur ton système :

*   **Python** (version 3.8 ou supérieure recommandée) : Tu peux le télécharger depuis [python.org](https://www.python.org/downloads/).
*   **pip** : Généralement installé avec Python. C'est le gestionnaire de paquets de Python.

## 2. Installation de Gemini CLI

Ouvre ton terminal (ou l'invite de commande sur Windows) et exécute la commande suivante pour installer Gemini CLI via `pip` :

```bash
pip install -U google-generativeai
```

Cette commande installe la bibliothèque officielle de Google pour interagir avec les modèles Gemini.

## 3. Configuration de la clé API

Pour utiliser Gemini, tu auras besoin d'une clé API.
1.  Rends-toi sur la [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Crée une nouvelle clé API.
3.  Copie ta clé API.

Ensuite, tu devras configurer cette clé API pour que la CLI de Gemini puisse l'utiliser. La manière la plus simple est de la définir comme variable d'environnement :

**Sur Linux/macOS :**
```bash
export GOOGLE_API_KEY="YOUR_API_KEY"
```

**Sur Windows (CMD) :**
```bash
set GOOGLE_API_KEY="YOUR_API_KEY"
```

**Sur Windows (PowerShell) :**
```bash
$env:GOOGLE_API_KEY="YOUR_API_KEY"
```

Remplace `"YOUR_API_KEY"` par la clé que tu as copiée. Pour que cette variable soit persistante (garde la clé après avoir fermé le terminal), tu devras l'ajouter à ton fichier de configuration de shell (`.bashrc`, `.zshrc` pour Linux/macOS) ou via les paramètres système de Windows.

## 4. Utilisation de base

Une fois installé et configuré avec ta clé API, tu peux commencer à utiliser la bibliothèque Python pour interagir avec Gemini. Voici un exemple simple pour tester :

1.  Ouvre un interpréteur Python en tapant `python` dans ton terminal.
2.  Entre les commandes suivantes :

    ```python
    import google.generativeai as genai
    import os

    # Configure ta clé API (elle est lue depuis la variable d'environnement)
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))

    # Initialise le modèle
    model = genai.GenerativeModel('gemini-pro')

    # Génère du contenu
    response = model.generate_content("Dis-moi une blague.")
    print(response.text)
    ```

Ceci devrait te donner une blague générée par Gemini.

N'hésite pas à consulter la documentation officielle de Gemini pour des utilisations plus avancées.
