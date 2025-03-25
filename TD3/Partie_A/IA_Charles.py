import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
from flask import Flask, request, jsonify
import numpy as np

def train_model(csv_path):
    df = pd.read_csv(csv_path)
    
    X = df[['SepalLengthCm', 'SepalWidthCm', 'PetalLengthCm', 'PetalWidthCm']]
    y = df['Species']
    
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.9, random_state=4)
    
    model = RandomForestClassifier(n_estimators=2, random_state=4)
    model.fit(X_train, y_train)
    
    joblib.dump(model, 'iris_model.pkl')
    joblib.dump(le, 'label_encoder.pkl')
    
    print("Modèle entraîné et sauvegardé avec succès.")

def predict_species(sepal_length, sepal_width, petal_length, petal_width):
    model = joblib.load('iris_model.pkl')
    le = joblib.load('label_encoder.pkl')
    
    prediction = model.predict([[sepal_length, sepal_width, petal_length, petal_width]])
    predicted_class = le.inverse_transform(prediction)[0]
    probabilities = model.predict_proba([[sepal_length, sepal_width, petal_length, petal_width]])[0]
    
    return predicted_class, probabilities

train_model("iris.csv")

app = Flask(__name__)

@app.route('/')
def home():
    return "API de prédiction de l'Iris avec Flask"

@app.route('/predict', methods=['GET'])
def predict():
    try:
        sepal_length = request.args.get("sepal_length", type=float)
        sepal_width = request.args.get("sepal_width", type=float)
        petal_length = request.args.get("petal_length", type=float)
        petal_width = request.args.get("petal_width", type=float)

        if None in [sepal_length, sepal_width, petal_length, petal_width]:
            return jsonify({"error": "Il manque des paramètres."}), 400

        predicted_class, probabilities = predict_species(sepal_length, sepal_width, petal_length, petal_width)

        return jsonify({
            "class_name": predicted_class,
            "probabilities": probabilities.tolist()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port = 5001, debug=True)
