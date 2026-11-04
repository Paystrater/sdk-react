package encryption

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"

	"paystrater-developer-service/internal/app/dto/v1/gatewayDto"
)

type sdkVector struct {
	MerchantSecretKey  string `json:"merchantSecretKey"`
	MerchantPublicKey  string `json:"merchantPublicKey"`
	KeyID              string `json:"keyId"`
	EphemeralPublicKey string `json:"ephemeralPublicKey"`
	SharedSecretX      string `json:"sharedSecretX"`
	Request            struct {
		Plaintext, IV, AuthTag, Ciphertext string
	} `json:"request"`
	Response struct {
		Plaintext, IV, AuthTag, Ciphertext string
	} `json:"response"`
}

// The SDK's vector, opened with this service's own code (openBody, deriveKey, openGCM)
func TestSDKEncryptionVector(t *testing.T) {
	raw, err := os.ReadFile(os.Getenv("SDK_VECTOR"))
	if err != nil {
		t.Fatal(err)
	}
	var v sdkVector
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatal(err)
	}
	secretBytes, _ := hex.DecodeString(v.MerchantSecretKey)
	priv := secp256k1.PrivKeyFromBytes(secretBytes)
	if got := hex.EncodeToString(priv.PubKey().SerializeUncompressed()); got != v.MerchantPublicKey {
		t.Fatalf("merchant public key: got %s", got)
	}
	ephemeral, err := parseEphemeral(v.EphemeralPublicKey)
	if err != nil {
		t.Fatalf("parseEphemeral: %v", err)
	}
	secret := secp256k1.GenerateSharedSecret(priv, ephemeral)
	if hex.EncodeToString(secret) != v.SharedSecretX {
		t.Fatalf("shared secret differs: %x", secret)
	}
	plaintext, responseKey, err := openBody(secret, gatewayDto.EncryptedBody{
		KeyID: v.KeyID, EphemeralPublicKey: v.EphemeralPublicKey, IV: v.Request.IV, AuthTag: v.Request.AuthTag, Ciphertext: v.Request.Ciphertext,
	})
	if err != nil {
		t.Fatalf("openBody: %v", err)
	}
	if string(plaintext) != v.Request.Plaintext {
		t.Fatalf("request plaintext: %s", plaintext)
	}
	iv, _ := base64.StdEncoding.DecodeString(v.Response.IV)
	tag, _ := base64.StdEncoding.DecodeString(v.Response.AuthTag)
	ct, _ := base64.StdEncoding.DecodeString(v.Response.Ciphertext)
	opened, err := openGCM(responseKey, iv, append(ct, tag...))
	if err != nil {
		t.Fatalf("response did not open with the server's response key: %v", err)
	}
	if string(opened) != v.Response.Plaintext {
		t.Fatalf("response plaintext: %s", opened)
	}
}
