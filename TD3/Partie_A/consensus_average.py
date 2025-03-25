from flask import Flask, request, jsonify
import requests
import numpy as np

app = Flask(__name__)

MODEL_APIS = [
    "https://e8ed-89-30-29-68.ngrok-free.app/predict",
    "https://a8b9-89-30-29-68.ngrok-free.app/predict",
    "https://f929-89-30-29-68.ngrok-free.app/predict",
    "https://6670-89-30-29-68.ngrok-free.app/predict",
    "https://f5e0-89-30-29-68.ngrok-free.app/predict"
]

@app.route('/consensus', methods=['GET'])
def consensus_prediction():
    try:
        params = {
            "sepal_length": request.args.get("sepal_length"),
            "sepal_width": request.args.get("sepal_width"),
            "petal_length": request.args.get("petal_length"),
            "petal_width": request.args.get("petal_width"),
        }

        probabilities = []

        for api in MODEL_APIS:
            try:
                response = requests.get(api, params=params)
                print(response)
                if response.status_code == 200:
                    data = response.json()
                    probabilities.append(np.array(data["probabilities"]))
                else:
                    print(f"Erreur avec {api}: {response.status_code}")
            except Exception as e:
                print(f"Échec de connexion à {api}: {e}")

        if not probabilities:
            return jsonify({"error": "Aucune réponse des modèles"}), 500

        avg_probabilities = np.mean(probabilities, axis=0)
        consensus_class = int(np.argmax(avg_probabilities))

        return jsonify({
            "class_name": "Iris-"+["setosa", "versicolor", "virginica"][consensus_class],
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
