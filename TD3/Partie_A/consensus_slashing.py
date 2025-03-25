import json
import numpy as np
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

DB_path = "model.json"

def load_model_data():
    with open(DB_path, "r") as f:
        return json.load(f)

def save_model_data(data):
    with open(DB_path, "w") as f:
        json.dump(data, f, indent=4)

def update_weights(api, model_probabilities, consensus_class):
    model_data = load_model_data()
    
    if api in model_data:
        correct_prediction = np.argmax(model_probabilities) == consensus_class
        
        if correct_prediction:
            model_data[api]["weight"] = min(model_data[api]["weight"] + 0.05, 1.0)
        else:
            model_data[api]["weight"] = max(model_data[api]["weight"] - 0.1, 0.1)
            model_data[api]["balance"] -= 50
            if model_data[api]["balance"] <= 0:
                del model_data[api]

    save_model_data(model_data)

@app.route('/consensus', methods=['GET'])
def consensus_prediction():
    try:
        params = {
            "sepal_length": request.args.get("sepal_length"),
            "sepal_width": request.args.get("sepal_width"),
            "petal_length": request.args.get("petal_length"),
            "petal_width": request.args.get("petal_width"),
        }

        model_data = load_model_data()
        MODEL_APIS = list(model_data.keys())

        probabilities = []
        weights = []

        for api in MODEL_APIS:
            try:
                response = requests.get(api, params=params)
                if response.status_code == 200:
                    data = response.json()
                    probabilities.append(np.array(data["probabilities"]))
                    weights.append(model_data[api]["weight"])
                else:
                    print(f"Erreur avec {api}: {response.status_code}")
            except Exception as e:
                print(f"Échec de connexion à {api}: {e}")

        if not probabilities:
            return jsonify({"error": "Aucune réponse des modèles"}), 500

        avg_probabilities = np.average(probabilities, axis=0, weights=weights)
        consensus_class = int(np.argmax(avg_probabilities))

        for i, api in enumerate(MODEL_APIS):
            update_weights(api, probabilities[i], consensus_class)

        return jsonify({
            "class_name": "Iris-" + ["setosa", "versicolor", "virginica"][consensus_class],
            "avg_probabilities": avg_probabilities.tolist()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
