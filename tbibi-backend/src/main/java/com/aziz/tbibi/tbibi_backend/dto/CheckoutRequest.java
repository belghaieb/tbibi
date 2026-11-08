package com.aziz.tbibi.tbibi_backend.dto;
public class CheckoutRequest {

    private String planCode;
    private Number amountHint;
    private String currency;

    public String getPlanCode() {
        return planCode;
    }

    public void setPlanCode(String planCode) {
        this.planCode = planCode;
    }

    public Number getAmountHint() {
        return amountHint;
    }

    public void setAmountHint(Number amountHint) {
        this.amountHint = amountHint;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}